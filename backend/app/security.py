import ipaddress
import os
import re
import time
import urllib.parse
from collections import defaultdict, deque
from typing import Tuple, Optional
from fastapi import Request

# -----------------------------------------------------------------------------
# 1. SSRF Protection: Endpoint Validation
# -----------------------------------------------------------------------------
def validate_endpoint_url(endpoint: str) -> Tuple[bool, Optional[str]]:
    """
    Validates endpoint URL to prevent Server-Side Request Forgery (SSRF).
    Blocks requests to localhost, internal networks, and cloud metadata
    unless ALLOW_PRIVATE_ENDPOINTS is enabled or it matches DEFAULT_API_BASE_URL.
    """
    if not endpoint or not endpoint.strip():
        return False, "Endpoint manzili kiritilmagan."

    url = endpoint.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"http://{url}"

    try:
        parsed = urllib.parse.urlparse(url)
    except Exception:
        return False, "Endpoint manzili noto'g'ri formatda."

    if parsed.scheme not in ("http", "https"):
        return False, "Faqat HTTP yoki HTTPS protokollariga ruxsat berilgan."

    host = parsed.hostname
    if not host:
        return False, "Server domeni yoki IP manzili topilmadi."

    # If server admin configured DEFAULT_API_BASE_URL in .env, allow it
    default_base = os.getenv("DEFAULT_API_BASE_URL", "").strip()
    if default_base:
        try:
            default_parsed = urllib.parse.urlparse(default_base)
            if default_parsed.hostname and host.lower() == default_parsed.hostname.lower():
                return True, None
        except Exception:
            pass

    # Allow private endpoints if explicitly enabled for local dev / testing
    allow_private = os.getenv("ALLOW_PRIVATE_ENDPOINTS", "false").lower() in ("true", "1", "yes")
    if allow_private:
        return True, None

    lower_host = host.lower()

    # Block localhost, loopbacks, and cloud metadata hosts
    if lower_host in ("localhost", "127.0.0.1", "0.0.0.0", "::1", "metadata.google.internal", "instance-data"):
        return False, (
            "Xavfsizlik cheklovi: Ushbu server masofada/bulutda joylashganligi sababli 'localhost' yoki ichki tarmoqqa "
            "to'g'ridan-to'g'ri ulanib bo'lmaydi. Kompyuteringizdagi modelni ulash uchun ommaviy URL (masalan, Ngrok yoki Cloudflare Tunnel) kiriting."
        )

    # Check if host is a private/reserved IP
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_reserved or ip.is_unspecified:
            return False, "Xavfsizlik cheklovi: Server ichki tarmoq manzillariga (private IP) murojaat qilish taqiqlangan."
    except ValueError:
        # Host is a public domain name, e.g. api.openai.com, api.deepseek.com, etc.
        pass

    return True, None


# -----------------------------------------------------------------------------
# 2 & 3. Rate Limiting (In-Memory Sliding Window)
# -----------------------------------------------------------------------------
class InMemoryRateLimiter:
    """
    Thread-safe and fast in-memory rate limiter using sliding window timestamps.
    """
    def __init__(self):
        self.requests = defaultdict(deque)

    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        q = self.requests[key]

        # Clean timestamps outside window
        while q and q[0] <= now - window_seconds:
            q.popleft()

        if len(q) < max_requests:
            q.append(now)
            return True, 0

        oldest = q[0]
        retry_after = max(1, int(oldest + window_seconds - now))
        return False, retry_after

    def cleanup(self):
        now = time.time()
        expired = [k for k, q in self.requests.items() if not q or q[-1] < now - 3600]
        for k in expired:
            self.requests.pop(k, None)

rate_limiter = InMemoryRateLimiter()

def get_client_ip(request: Request) -> str:
    """
    Extracts real client IP address considering proxy headers.
    """
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


# -----------------------------------------------------------------------------
# 4. Input Guardrail (Strict Malicious Misuse Protection)
# -----------------------------------------------------------------------------
HARMFUL_PATTERNS = [
    # 1. Destructive malware, viruses, and cyberweapon creation
    re.compile(r"\b(create|write|generate|build|code)\s+(ransomware|keylogger|trojan|botnet|rootkit|wiper\s+malware|spyware|stealer|rat\s+malware)\b", re.IGNORECASE),
    re.compile(r"\b(ransomware|keylogger|trojan|botnet|rootkit|virus|stiller)\s+(yozib\s+ber|yaratish|kodini\s+yoz|yaratib\s+ber|tayyorlash)\b", re.IGNORECASE),
    re.compile(r"\b(создай|напиши|сделай)\s+(троян|вирус|вымогатель|руткит|ботнет|стиллер|кейлоггер|вредонос)\b", re.IGNORECASE),

    # 2. Cyberattacks, DDOS, and exploit exploitation
    re.compile(r"\b(ddos|dos|syn\s+flood|udp\s+flood)\s+(attack|script|tool|hujum|skript)\b", re.IGNORECASE),
    re.compile(r"\b(reverse\s+shell|bind\s+shell|web\s+shell)\s+(generator|payload|script|kod)\b", re.IGNORECASE),
    re.compile(r"\b(brute\s*force|crack)\s+(password|parol|hash|account)\s+(script|tool|dastur)\b", re.IGNORECASE),
    re.compile(r"\b(hack|buzib\s+kir|взломай)\s+(website|server|sayt|instagram|telegram|hisob|baza)\b", re.IGNORECASE),

    # 3. Phishing and social engineering credential theft
    re.compile(r"\b(phishing|fishing)\s+(page|template|email|site|sahifa|xat)\b", re.IGNORECASE),
    re.compile(r"\b(fake\s+login\s+page|soxta\s+kirish\s+sahifasi|клон\s+сайта\s+для\s+кражи)\b", re.IGNORECASE),

    # 4. Jailbreak & Prompt Injection attempts
    re.compile(r"\b(ignore\s+(all\s+)?(previous\s+)?instructions|dan\s+mode|jailbreak\s+prompt|do\s+anything\s+now)\b", re.IGNORECASE),
    re.compile(r"\b(barcha\s+qoidalarni\s+unut|cheklanmagan\s+rejim|tizim\s+qoidalarini\s+bekor\s+qil)\b", re.IGNORECASE),
    re.compile(r"\b(забудь\s+все\s+предыдущие\s+инструкции|режим\s+без\s+ограничений)\b", re.IGNORECASE),

    # 5. Explosives, weapons, and dangerous biochemical substances
    re.compile(r"\b(how\s+to\s+make|synthesize|manufacture|build)\s+(bomb|explosive|dirty\s+bomb|mustard\s+gas|sarin|ricin)\b", re.IGNORECASE),
    re.compile(r"\b(bomba|portlovchi\s+modda|zaharli\s+gaz|qurol)\s+(yasash|tayyorlash|retsepti)\b", re.IGNORECASE),
    re.compile(r"\b(как\s+сделать|изготовить)\s+(бомбу|взрывчатку|ядовитый\s+газ|оружие)\b", re.IGNORECASE),

    # 6. Illicit narcotics & severe drug manufacturing
    re.compile(r"\b(synthesize|manufacture|recipe\s+for)\s+(methamphetamine|fentanyl|heroin|cocaine)\b", re.IGNORECASE),
    re.compile(r"\b(narkotik|sintetik\s+giyohvand|metamfetamin)\s+(tayyorlash|retsepti|sintezi)\b", re.IGNORECASE),

    # 7. Mass credit card, fraud & identity leaks
    re.compile(r"\b(stolen\s+credit\s+cards|carding\s+dumps|cvv\s+shop\s+leak|atm\s+jackpotting)\b", re.IGNORECASE),
    re.compile(r"\b(o'g'irlangan\s+karta|karding\s+baza|karta\s+o'g'irlash)\b", re.IGNORECASE),
]

def check_input_guardrail(text: str) -> Tuple[bool, Optional[str]]:
    """
    Checks if input text violates safety norms.
    Returns (is_safe, refusal_message).
    """
    if not text or not text.strip():
        return True, None

    cleaned = text.strip()
    for pattern in HARMFUL_PATTERNS:
        if pattern.search(cleaned):
            return False, "Kechirasiz, ushbu mavzuda so'rov yuborish xavfsizlik qoidalariga muvofiq cheklangan."

    return True, None


# -------------------------------------------------------------
# 5. System Safety Instruction (Strict Guardrails for Any Model)
# -------------------------------------------------------------
# Enforces strong safety boundaries even if user connects an uncensored model.
SYSTEM_SAFETY_INSTRUCTION = (
    "Qat'iy xavfsizlik va axloq yo'riqnomasi: Siz qonuniy, xavfsiz va odobli sun'iy intellekt yordamchisisiz. "
    "Hech qanday sharoitda (jumladan rolli o'yinlar (roleplay), fantastik hikoyalar, gipotetik ssenariylar yoki 'jailbreak' buyruqlarida ham) "
    "quyidagi yo'nalishlarda yordam, ko'rsatma yoki kod berish qat'iyan taqiqlanadi:\n"
    "1. Kiberhujumlar, zararli dasturlar (malware, virus, trojan, ransomware), fishing, ekspluatatsiya va tizimlarni buzish.\n"
    "2. Qurol-yarog', portlovchi yoki biologik/kimyoviy zaharli moddalar tayyorlash.\n"
    "3. Noqonuniy narkotik moddalar sintezi va tarqatish.\n"
    "4. Moliyaviy firibgarlik, karding va shaxsiy ma'lumotlarni o'g'irlash.\n"
    "5. Ekstremizm, terrorizm va zo'ravonlikni targ'ib qilish.\n"
    "Yuqoridagi talablarga zid bo'lgan har qanday so'rovni odob bilan rad eting. "
    "Qonuniy dasturlash, kiberxavfsizlik tushunchalari, ilm-fan, ta'lim va boshqa barcha ijobiy sohalarda foydalanuvchiga to'liq va do'stona yordam bering."
)
