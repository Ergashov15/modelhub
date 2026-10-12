import logging
from typing import List, Dict
from urllib.parse import urlparse, parse_qs, unquote
import httpx
import lxml.html

logger = logging.getLogger("qwen_ui.search")

async def search_duckduckgo(query: str, max_results: int = 5) -> List[Dict[str, str]]:
    """
    Search DuckDuckGo HTML endpoint and extract organic results with title, URL, snippet and domain.
    Does not require any API key and runs asynchronously.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,uz;q=0.8,ru;q=0.7",
    }

    results: List[Dict[str, str]] = []

    try:
        async with httpx.AsyncClient(timeout=9.0, follow_redirects=True) as client:
            resp = await client.post(
                "https://html.duckduckgo.com/html/",
                data={"q": clean_query},
                headers=headers,
            )

            if resp.status_code != 200 or not resp.text:
                logger.warning(f"DuckDuckGo search returned status {resp.status_code}")
                return []

            doc = lxml.html.fromstring(resp.text)
            items = doc.xpath("//div[contains(@class, 'result__body')]")

            for item in items:
                link_nodes = item.xpath(".//h2[contains(@class, 'result__title')]//a")
                if not link_nodes:
                    continue

                title = link_nodes[0].text_content().strip()
                raw_href = link_nodes[0].get("href", "")

                # Decode actual URL from DDG redirect /l/?uddg=...
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

                # Extract snippet
                snippet = ""
                snippet_nodes = item.xpath(
                    ".//a[contains(@class, 'result__snippet')] | "
                    ".//div[contains(@class, 'result__snippet')]"
                )
                if snippet_nodes:
                    snippet = snippet_nodes[0].text_content().strip()

                # Extract clean domain name for UI display
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
        logger.error(f"Error during DuckDuckGo search for '{clean_query}': {e}")

    return results
