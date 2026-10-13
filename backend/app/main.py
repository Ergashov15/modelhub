import os
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from .security import (
    validate_endpoint_url,
    rate_limiter,
    get_client_ip,
    check_input_guardrail,
    SYSTEM_SAFETY_INSTRUCTION
)

from .schemas import (
    ChatRequest, TestConnectionRequest, TestConnectionResponse, ModelsRequest,
    RegisterRequest, LoginRequest, AuthResponse, AuthUser
)
from .client import test_endpoint_connection, fetch_available_models, stream_chat_completion
from .search import search_duckduckgo
from .db import (
    init_db, create_user, authenticate_user, create_session, get_user_by_token, delete_session,
    get_user_conversations, save_user_conversations, delete_user_conversation
)

logger = logging.getLogger("qwen_ui.main")

load_dotenv()

# Initialize database tables on startup
try:
    init_db()
except Exception as e:
    logger.error(f"Database initialization failed: {e}")

app = FastAPI(
    title="Qwen UI Server",
    description="Universal API proxy and UI backend for self-hosted and cloud Qwen models",
    version="1.0.0"
)

# Enable CORS for local development (frontend running on port 5173, backend on 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health_check():
    return {
        "status": "ok",
        "default_endpoint": os.getenv("DEFAULT_API_BASE_URL", ""),
        "default_model": os.getenv("DEFAULT_MODEL", "")
    }

@app.post("/api/auth/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    try:
        user = create_user(
            username=req.username,
            password=req.password,
            email=req.email,
            display_name=req.display_name
        )
        token = create_session(user["id"])
        return AuthResponse(
            success=True,
            token=token,
            user=AuthUser(**user),
            message="Muvaffaqiyatli ro'yxatdan o'tdingiz!"
        )
    except ValueError as e:
        return AuthResponse(success=False, message=str(e))
    except Exception as e:
        logger.error(f"Registration error: {e}")
        return AuthResponse(success=False, message="Ro'yxatdan o'tishda xatolik yuz berdi.")

@app.post("/api/auth/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        return AuthResponse(success=False, message="Noto'g'ri foydalanuvchi nomi yoki parol.")
    
    token = create_session(user["id"])
    return AuthResponse(
        success=True,
        token=token,
        user=AuthUser(**user),
        message="Xush kelibsiz!"
    )

@app.get("/api/auth/me", response_model=AuthResponse)
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return AuthResponse(success=False, message="Avtorizatsiya talab qilinadi.")
    
    token = authorization.replace("Bearer ", "").strip()
    user = get_user_by_token(token)
    if not user:
        return AuthResponse(success=False, message="Sessiya eskirgan yoki topilmadi.")
    
    return AuthResponse(success=True, user=AuthUser(**user))

@app.post("/api/auth/logout", response_model=AuthResponse)
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization.replace("Bearer ", "").strip()
        delete_session(token)
    return AuthResponse(success=True, message="Hisobdan chiqildi.")

@app.get("/api/user/conversations")
async def get_user_chats(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Avtorizatsiya talab qilinadi.")
    token = authorization.replace("Bearer ", "").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessiya eskirgan yoki topilmadi.")
    
    chats = get_user_conversations(user["id"])
    return {"conversations": chats}

@app.post("/api/user/conversations")
async def save_user_chats(
    req: Dict[str, Any],
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Avtorizatsiya talab qilinadi.")
    token = authorization.replace("Bearer ", "").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessiya eskirgan yoki topilmadi.")
    
    chats = req.get("conversations", [])
    if isinstance(chats, list):
        save_user_conversations(user["id"], chats)
    return {"success": True, "count": len(chats)}

@app.delete("/api/user/conversations/{conv_id}")
async def delete_user_chat(
    conv_id: str,
    authorization: Optional[str] = Header(None)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Avtorizatsiya talab qilinadi.")
    token = authorization.replace("Bearer ", "").strip()
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Sessiya eskirgan yoki topilmadi.")
    
    delete_user_conversation(user["id"], conv_id)
    return {"success": True}

@app.post("/api/test-connection", response_model=TestConnectionResponse)
async def test_connection(req: TestConnectionRequest, request: Request):
    if not req.endpoint or not req.endpoint.strip():
        raise HTTPException(status_code=400, detail="Endpoint URL is required.")

    client_ip = get_client_ip(request)

    # 1. Rate limiting (20 requests/min)
    allowed, retry_after = rate_limiter.is_allowed(f"test:{client_ip}", max_requests=20, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Juda ko'p so'rovlar yuborildi. Iltimos, {retry_after} soniyadan so'ng qayta urinib ko'ring."
        )

    # 2. SSRF validation
    is_valid, error_msg = validate_endpoint_url(req.endpoint)
    if not is_valid:
        return TestConnectionResponse(success=False, message=error_msg or "Xavfsizlik cheklovi", models=[])

    result = await test_endpoint_connection(
        endpoint=req.endpoint,
        api_key=req.api_key,
        model=req.model
    )
    return TestConnectionResponse(**result)

@app.post("/api/models")
async def get_models(req: ModelsRequest, request: Request):
    if not req.endpoint or not req.endpoint.strip():
        return {"models": []}

    client_ip = get_client_ip(request)

    # 1. Rate limiting (20 requests/min)
    allowed, retry_after = rate_limiter.is_allowed(f"models:{client_ip}", max_requests=20, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Juda ko'p so'rovlar yuborildi. Iltimos, {retry_after} soniyadan so'ng qayta urinib ko'ring."
        )

    # 2. SSRF validation
    is_valid, error_msg = validate_endpoint_url(req.endpoint)
    if not is_valid:
        return {"models": [], "error": error_msg}

    models = await fetch_available_models(endpoint=req.endpoint, api_key=req.api_key)
    return {"models": models}

@app.post("/api/chat")
async def chat_completion(req: ChatRequest, request: Request):
    if not req.endpoint or not req.endpoint.strip():
        raise HTTPException(status_code=400, detail="Endpoint URL is required.")
    if not req.model or not req.model.strip():
        raise HTTPException(status_code=400, detail="Model name is required.")

    client_ip = get_client_ip(request)

    # 1. Rate Limiting for Chat (30 requests per min per IP)
    allowed, retry_after = rate_limiter.is_allowed(f"chat:{client_ip}", max_requests=30, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail=f"So'rovlar soni limiti oshdi. Iltimos, {retry_after} soniyadan so'ng qayta urinib ko'ring."
        )

    # 2. SSRF check on target endpoint
    is_valid, endpoint_err = validate_endpoint_url(req.endpoint)
    if not is_valid:
        async def stream_ssrf_error():
            err_data = {
                "id": "ssrf-blocked",
                "object": "chat.completion.chunk",
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": f"⚠️ {endpoint_err}"},
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {json.dumps(err_data)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(stream_ssrf_error(), media_type="text/event-stream")

    # 3. Input Guardrail (Strict check across all incoming messages to prevent hidden injection)
    last_user_query = ""
    for m in reversed(req.messages):
        if m.role == "user":
            if isinstance(m.content, str):
                last_user_query = m.content
            elif isinstance(m.content, list):
                for part in m.content:
                    if isinstance(part, dict) and part.get("type") == "text":
                        last_user_query = part.get("text", "")
                        break
            break

    # Combine text from all incoming messages to catch hidden exploits in conversation history
    all_incoming_texts = []
    for m in req.messages:
        if isinstance(m.content, str):
            all_incoming_texts.append(m.content)
        elif isinstance(m.content, list):
            for part in m.content:
                if isinstance(part, dict) and part.get("type") == "text":
                    all_incoming_texts.append(part.get("text", ""))

    full_context_to_check = "\n".join(all_incoming_texts)

    is_safe, refusal_reason = check_input_guardrail(full_context_to_check)
    if not is_safe:
        async def stream_refusal():
            refusal_data = {
                "id": "guardrail-refusal",
                "object": "chat.completion.chunk",
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": refusal_reason},
                    "finish_reason": "stop"
                }]
            }
            yield f"data: {json.dumps(refusal_data)}\n\n"
            yield "data: [DONE]\n\n"
        return StreamingResponse(stream_refusal(), media_type="text/event-stream")

    messages_data = [m.model_dump() for m in req.messages]
    sources = []

    # 4. Web Search Rate Limit & Execution
    if req.web_search and last_user_query.strip():
        search_allowed, _ = rate_limiter.is_allowed(f"search:{client_ip}", max_requests=10, window_seconds=60)
        if not search_allowed:
            logger.warning(f"Web search rate limit exceeded for IP: {client_ip}. Proceeding without search.")
        else:
            logger.info(f"Web search activated for query: '{last_user_query.strip()}'")
            try:
                sources = await search_duckduckgo(last_user_query.strip(), max_results=5)
            except Exception as e:
                logger.error(f"Web search failed: {e}")

        if sources:
            sources_text = "\n\n".join([
                f"[{idx+1}] Manba: {s['title']} ({s['url']})\n{s['snippet']}"
                for idx, s in enumerate(sources)
            ])
            web_instruction = (
                f"[Internet qidiruvi ma'lumotlari (Web Search Results)]:\n"
                f"{sources_text}\n\n"
                f"Yo'riqnoma: Yuqoridagi internet qidiruvi ma'lumotlariga tayangan holda foydalanuvchining savoliga to'g'ridan-to'g'ri, lo'nda va to'liq javob bering. "
                f"Muhim qoida: Javob matnining oxirida manbalar ro'yxatini qayta takrorlab yozmang (chunki tizim manbalarni avtomatik tarzda pastda ko'rsatadi). "
                f"Faqat matn ichidagi faktlar yoniga qaysi manbadan olinganini [1], [2] kabi ixcham ko'rsatkichlar bilan belgilab keting."
            )

            has_system = False
            for m in messages_data:
                if m["role"] == "system":
                    m["content"] = str(m["content"]) + f"\n\n{web_instruction}"
                    has_system = True
                    break
            if not has_system:
                messages_data.insert(0, {"role": "system", "content": web_instruction})

    # 5. System Safety Instruction (Balanced)
    has_system_safety = False
    for m in messages_data:
        if m["role"] == "system":
            if SYSTEM_SAFETY_INSTRUCTION not in str(m["content"]):
                m["content"] = f"{SYSTEM_SAFETY_INSTRUCTION}\n\n" + str(m["content"])
            has_system_safety = True
            break
    if not has_system_safety:
        messages_data.insert(0, {"role": "system", "content": SYSTEM_SAFETY_INSTRUCTION})

    payload = {
        "model": req.model,
        "messages": messages_data,
        "temperature": req.temperature,
        "top_p": req.top_p,
        "stream": True,
    }
    if req.max_tokens is not None and req.max_tokens > 0:
        tokens_to_send = req.max_tokens
        # If client passed an impossibly large max_tokens (e.g. full context length like 262144),
        # clamp to 8192 to prevent 400 context exhaustion from LLM provider
        if tokens_to_send > 32768:
            logger.warning(f"max_tokens {tokens_to_send} exceeds safe generation limit, clamping to 8192")
            tokens_to_send = 8192
        payload["max_tokens"] = tokens_to_send

    async def stream_with_sources():
        if sources:
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        async for chunk in stream_chat_completion(
            endpoint=req.endpoint,
            api_key=req.api_key,
            payload=payload
        ):
            yield chunk

    return StreamingResponse(
        stream_with_sources(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

# Static file serving for production build
DIST_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")
    
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        file_path = DIST_DIR / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(DIST_DIR / "index.html")
else:
    logger.warning(
        f"Frontend dist papkasi topilmadi ({DIST_DIR}). "
        "Iltimos, 'cd frontend && npm install && npm run build' buyrug'ini bajaring."
    )

    @app.get("/{full_path:path}")
    async def no_dist_fallback(full_path: str):
        return HTMLResponse(
            """<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <title>ModelHub - Frontend yig'ilmagan</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F7F5EE; color: #1F2937; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: white; padding: 32px; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.06); max-width: 580px; width: 100%; border: 1px solid #E5E7EB; }
        h2 { color: #047857; margin-top: 0; font-size: 20px; }
        p { line-height: 1.6; color: #4B5563; }
        code { background: #F3F4F6; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #111827; }
        pre { background: #1F2937; color: #10B981; padding: 12px 16px; border-radius: 8px; font-size: 14px; overflow-x: auto; margin: 8px 0; }
        .step { margin-top: 18px; padding: 14px; background: #FAFAF9; border-radius: 10px; border: 1px solid #E5E7EB; }
        a { color: #047857; font-weight: 600; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="card">
        <h2>⚠️ Frontend yig'ilmagan (Build qilinmagan)</h2>
        <p>Loyiha yangi kompyuterga klon qilinganda <code>frontend/dist</code> papkasi topilmadi. Tizim ishlashi uchun quyidagilardan birini bajaring:</p>
        <div class="step">
            <b>1-variant. Production uchun yig'ish (Tavsiya etiladi):</b>
            <pre>cd frontend
npm install
npm run build</pre>
            Shundan so'ng serverni qayta ishga tushiring yoki sahifani yangilang.
        </div>
        <div class="step">
            <b>2-variant. Ishlab chiquvchi (Dev) rejimi:</b>
            <pre>cd frontend
npm run dev</pre>
            Brauzerda <a href="http://localhost:5173">http://localhost:5173</a> manzilini oching.
        </div>
    </div>
</body>
</html>""",
            status_code=200
        )
