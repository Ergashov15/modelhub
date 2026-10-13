import re
import logging
from typing import List, Dict
from urllib.parse import urlparse, parse_qs, unquote
import httpx
import lxml.html

logger = logging.getLogger("qwen_ui.search")

def clean_search_query(raw_query: str) -> str:
    """
    Cleans and optimizes conversational user queries for search engines.
    Strips question words, conversational particles, and punctuation so that
    queries like 'money nima?' become 'money', avoiding false matches.
    """
    if not raw_query:
        return ""
    
    query = raw_query.strip().strip("?!.,;:\"'()[]{}")

    # Uzbek conversational phrases and question particles
    uz_patterns = [
        r'\b(nima\s+degani|nima\s+o[\'‘`]?zi|nima\s+ekan|nima)\b',
        r'\b(haqida\s+ma[\'‘`]?lumot|haqida|to[\'‘`]?g[\'‘`]?risida)\b',
        r'\b(qanday\s+ishlaydi|qanaqa|qanday|qayerda|qayer|qachon|kim)\b',
        r'\b(aytib\s+bering|tushuntirib\s+bering|ma[\'‘`]?nosi\s+nima)\b',
    ]
    cleaned = query
    for pat in uz_patterns:
        cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)

    # Russian conversational phrases
    ru_patterns = [
        r'\b(что\s+такое|что\s+это|как\s+работает|где\s+находится|кто\s+такой)\b',
        r'\b(расскажи\s+про|расскажи\s+о|информация\s+о|информация\s+про)\b',
    ]
    for pat in ru_patterns:
        cleaned = re.sub(pat, ' ', cleaned, flags=re.IGNORECASE)

    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    # If stripped version is valid and non-empty, use it
    if cleaned and len(cleaned) >= 2:
        return cleaned

    return query

async def search_duckduckgo(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search DuckDuckGo (using lite and html endpoints) and extract organic results with title, URL, snippet and domain.
    Does not require any API key and runs asynchronously.
    """
    raw_query = query.strip()
    if not raw_query:
        return []

    # Clean query to prevent conversational words matching unintended tokens
    optimized_query = clean_search_query(raw_query)
    logger.info(f"Searching web for: '{optimized_query}' (original: '{raw_query}')")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,uz;q=0.8,ru;q=0.7",
    }

    results: List[Dict[str, str]] = []

    async with httpx.AsyncClient(timeout=9.0, follow_redirects=True) as client:
        # 1. Try DuckDuckGo Lite endpoint first (very reliable, zero bot blocks)
        try:
            resp = await client.post(
                "https://lite.duckduckgo.com/lite/",
                data={"q": optimized_query},
                headers=headers,
            )
            if resp.status_code == 200 and resp.text:
                doc = lxml.html.fromstring(resp.text)
                links = doc.xpath('//a[@class="result-link"]')
                snippets = doc.xpath('//td[@class="result-snippet"]')

                for idx, link in enumerate(links):
                    title = link.text_content().strip()
                    raw_href = link.get("href", "")
                    actual_url = raw_href

                    if "uddg=" in raw_href:
                        try:
                            parsed = urlparse(raw_href)
                            qs = parse_qs(parsed.query)
                            if "uddg" in qs and qs["uddg"]:
                                actual_url = unquote(qs["uddg"][0])
                        except Exception:
                            pass

                    if not actual_url or not actual_url.startswith("http"):
                        continue

                    snippet = ""
                    if idx < len(snippets):
                        snippet = snippets[idx].text_content().strip()

                    domain = urlparse(actual_url).netloc.lower()
                    if domain.startswith("www."):
                        domain = domain[4:]

                    results.append({
                        "title": title,
                        "url": actual_url,
                        "snippet": snippet,
                        "domain": domain,
                    })

                    if len(results) >= max_results:
                        break

                if results:
                    return results
        except Exception as e:
            logger.debug(f"DDG Lite search failed: {e}")

        # 2. Fallback to standard DuckDuckGo HTML endpoint
        try:
            resp = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": optimized_query},
                headers=headers,
            )
            if resp.status_code == 200 and resp.text:
                doc = lxml.html.fromstring(resp.text)
                items = doc.xpath("//div[contains(@class, 'result__body')]")

                for item in items:
                    link_nodes = item.xpath(".//h2[contains(@class, 'result__title')]//a")
                    if not link_nodes:
                        continue

                    title = link_nodes[0].text_content().strip()
                    raw_href = link_nodes[0].get("href", "")
                    actual_url = raw_href

                    if "uddg=" in raw_href:
                        try:
                            parsed = urlparse(raw_href)
                            qs = parse_qs(parsed.query)
                            if "uddg" in qs and qs["uddg"]:
                                actual_url = unquote(qs["uddg"][0])
                        except Exception:
                            pass

                    if not actual_url or not actual_url.startswith("http"):
                        continue

                    snippet = ""
                    snippet_nodes = item.xpath(
                        ".//a[contains(@class, 'result__snippet')] | "
                        ".//div[contains(@class, 'result__snippet')]"
                    )
                    if snippet_nodes:
                        snippet = snippet_nodes[0].text_content().strip()

                    domain = urlparse(actual_url).netloc.lower()
                    if domain.startswith("www."):
                        domain = domain[4:]

                    results.append({
                        "title": title,
                        "url": actual_url,
                        "snippet": snippet,
                        "domain": domain,
                    })

                    if len(results) >= max_results:
                        break
        except Exception as e:
            logger.error(f"Error during DuckDuckGo HTML search for '{optimized_query}': {e}")

    return results
