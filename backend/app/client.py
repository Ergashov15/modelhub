import json
import logging
from typing import AsyncGenerator, Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)

def normalize_base_url(url: str) -> str:
    if not url:
        return ""
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = f"http://{url}"
    url = url.rstrip("/")
    if url.endswith("/chat/completions"):
        url = url[:-len("/chat/completions")].rstrip("/")
    return url

def get_candidate_base_urls(endpoint: str) -> List[str]:
    base = normalize_base_url(endpoint)
    if not base:
        return []
    
    urls = [base]
    # Swap localhost and 127.0.0.1 for local robustness on Windows
    if "://localhost" in base:
        urls.append(base.replace("://localhost", "://127.0.0.1"))
    elif "://127.0.0.1" in base:
        urls.append(base.replace("://127.0.0.1", "://localhost"))
        
    seen = set()
    result = []
    for u in urls:
        u_clean = u.rstrip("/")
        if u_clean not in seen:
            seen.add(u_clean)
            result.append(u_clean)
    return result

def get_candidate_chat_urls(endpoint: str) -> List[str]:
    bases = get_candidate_base_urls(endpoint)
    chat_urls = []
    for b in bases:
        if b.endswith("/v1"):
            chat_urls.append(f"{b}/chat/completions")
        else:
            # Check /v1/chat/completions first (Ollama, LM Studio, llama.cpp, vLLM)
            chat_urls.append(f"{b}/v1/chat/completions")
            chat_urls.append(f"{b}/chat/completions")
            
    seen = set()
    result = []
    for u in chat_urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result

def get_candidate_models_urls(endpoint: str) -> List[str]:
    bases = get_candidate_base_urls(endpoint)
    models_urls = []
    for b in bases:
        if b.endswith("/v1"):
            models_urls.append(f"{b}/models")
            root = b[:-3].rstrip("/")
            if root:
                models_urls.append(f"{root}/api/tags")
        else:
            models_urls.append(f"{b}/v1/models")
            models_urls.append(f"{b}/models")
            models_urls.append(f"{b}/api/tags")
            
    seen = set()
    result = []
    for u in models_urls:
        if u not in seen:
            seen.add(u)
            result.append(u)
    return result

def get_headers(api_key: Optional[str]) -> Dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if api_key and api_key.strip():
        headers["Authorization"] = f"Bearer {api_key.strip()}"
    return headers

async def fetch_available_models(endpoint: str, api_key: Optional[str]) -> List[str]:
    if not endpoint or not endpoint.strip():
        return []
    
    headers = get_headers(api_key)
    timeout = httpx.Timeout(8.0, connect=3.0)
    candidate_urls = get_candidate_models_urls(endpoint)
    
    async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
        for url in candidate_urls:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    models: List[str] = []
                    # 1. Standard OpenAI {"data": [{"id": ...}]}
                    if isinstance(data, dict) and "data" in data and isinstance(data["data"], list):
                        models = [m.get("id") or m.get("name") for m in data["data"] if isinstance(m, dict) and (m.get("id") or m.get("name"))]
                    # 2. Ollama native {"models": [{"name": ...}]}
                    elif isinstance(data, dict) and "models" in data and isinstance(data["models"], list):
                        models = [m.get("name") or m.get("model") for m in data["models"] if isinstance(m, dict) and (m.get("name") or m.get("model"))]
                    # 3. Direct list [{"id": ...}]
                    elif isinstance(data, list):
                        models = [m.get("id") or m.get("name") for m in data if isinstance(m, dict) and (m.get("id") or m.get("name"))]
                    
                    valid_models = [m for m in models if m]
                    if valid_models:
                        seen = set()
                        unique_models = []
                        for m in valid_models:
                            if m not in seen:
                                seen.add(m)
                                unique_models.append(m)
                        return unique_models
            except Exception as e:
                logger.debug(f"Models check at {url} failed: {e}")
                continue
    return []

async def test_endpoint_connection(endpoint: str, api_key: Optional[str], model: Optional[str] = None) -> Dict[str, Any]:
    if not endpoint or not endpoint.strip():
        return {
            "success": False,
            "message": "Endpoint kiritilmagan",
            "models": []
        }
        
    headers = get_headers(api_key)
    
    # 1. First try to discover models directly
    models_found = await fetch_available_models(endpoint, api_key)
    if models_found:
        return {
            "success": True,
            "message": f"Muvaffaqiyatli ulandi ({len(models_found)} model topildi)",
            "models": models_found
        }
    
    # 2. If models endpoint didn't respond, test candidate chat URLs with ping
    target_model = model or "qwen3.8"
    chat_urls = get_candidate_chat_urls(endpoint)
    timeout = httpx.Timeout(20.0, connect=6.0)
    
    async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
        last_error = "Serverga ulanib bo'lmadi"
        for url in chat_urls:
            payload = {
                "model": target_model,
                "messages": [{"role": "user", "content": "ping"}],
                "max_tokens": 1,
                "stream": False
            }
            try:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code == 200:
                    return {
                        "success": True,
                        "message": f"Muvaffaqiyatli ulandi ({target_model})",
                        "models": [target_model]
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "message": f"Avtorizatsiya xatosi ({resp.status_code}). API kalitni tekshiring.",
                        "models": []
                    }
                elif resp.status_code == 404:
                    raw_text = resp.text.lower()
                    if "model" in raw_text:
                        return {
                            "success": False,
                            "message": f"Model '{target_model}' topilmadi. Model nomini tekshiring.",
                            "models": []
                        }
                    # Endpoint route 404, try next candidate
                    last_error = f"Endpoint topilmadi (404): {url}"
                else:
                    last_error = f"Server statusi: {resp.status_code} ({resp.text[:100]})"
            except httpx.ConnectError:
                last_error = f"Ulanish rad etildi: {url}"
            except httpx.TimeoutException:
                last_error = "Kutish vaqti tugadi (Timeout)"
            except Exception as e:
                last_error = str(e)
                
        return {
            "success": False,
            "message": last_error,
            "models": []
        }

async def stream_chat_completion(
    endpoint: str,
    api_key: Optional[str],
    payload: Dict[str, Any]
) -> AsyncGenerator[str, None]:
    chat_urls = get_candidate_chat_urls(endpoint)
    headers = get_headers(api_key)
    # Generous timeout for local models initializing on CPU/GPU and large multimodal payloads
    timeout = httpx.Timeout(connect=30.0, read=300.0, write=180.0, pool=60.0)
    
    async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
        for idx, chat_url in enumerate(chat_urls):
            is_last = (idx == len(chat_urls) - 1)
            try:
                async with client.stream("POST", chat_url, headers=headers, json=payload) as response:
                    # If endpoint path 404 and not a model-not-found error, try next candidate
                    if response.status_code == 404:
                        raw_bytes = await response.aread()
                        error_msg = raw_bytes.decode("utf-8", errors="ignore")
                        if "model" not in error_msg.lower() and not is_last:
                            continue
                        
                        # Model not found or last candidate
                        error_detail = error_msg
                        try:
                            parsed_err = json.loads(error_msg)
                            if isinstance(parsed_err, dict) and "error" in parsed_err:
                                err_obj = parsed_err["error"]
                                error_detail = err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
                        except Exception:
                            pass
                            
                        yield f"data: {json.dumps({'error': f'Model topilmadi (404): {error_detail}'})}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    if response.status_code != 200:
                        raw_bytes = await response.aread()
                        error_msg = raw_bytes.decode("utf-8", errors="ignore")
                        error_detail = error_msg
                        try:
                            parsed_err = json.loads(error_msg)
                            if isinstance(parsed_err, dict) and "error" in parsed_err:
                                err_obj = parsed_err["error"]
                                error_detail = err_obj.get("message") if isinstance(err_obj, dict) else str(err_obj)
                        except Exception:
                            pass
                            
                        yield f"data: {json.dumps({'error': f'Xatolik ({response.status_code}): {error_detail}'})}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    # Successful 200 response - stream lines
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data:"):
                            yield f"{line}\n\n"
                        else:
                            yield f"data: {line}\n\n"
                    return

            except httpx.ConnectError:
                if not is_last:
                    continue
                yield f"data: {json.dumps({'error': f'Serverga ulanib bo‘lmadi ({chat_url})'})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except httpx.TimeoutException:
                yield f"data: {json.dumps({'error': 'Serverdan javob kutish vaqti tugadi (Timeout)'})}\n\n"
                yield "data: [DONE]\n\n"
                return
            except Exception as e:
                if not is_last:
                    continue
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                yield "data: [DONE]\n\n"
                return
