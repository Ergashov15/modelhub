import os
import json
import logging
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from .schemas import ChatRequest, TestConnectionRequest, TestConnectionResponse, ModelsRequest
from .client import test_endpoint_connection, fetch_available_models, stream_chat_completion
from .search import search_duckduckgo

logger = logging.getLogger("qwen_ui.main")

load_dotenv()

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

@app.post("/api/test-connection", response_model=TestConnectionResponse)
async def test_connection(req: TestConnectionRequest):
    if not req.endpoint or not req.endpoint.strip():
        raise HTTPException(status_code=400, detail="Endpoint URL is required.")
    
    result = await test_endpoint_connection(
        endpoint=req.endpoint,
        api_key=req.api_key,
        model=req.model
    )
    return TestConnectionResponse(**result)

@app.post("/api/models")
async def get_models(req: ModelsRequest):
    if not req.endpoint or not req.endpoint.strip():
        return {"models": []}
    models = await fetch_available_models(endpoint=req.endpoint, api_key=req.api_key)
    return {"models": models}

@app.post("/api/chat")
async def chat_completion(req: ChatRequest):
    if not req.endpoint or not req.endpoint.strip():
        raise HTTPException(status_code=400, detail="Endpoint URL is required.")
    if not req.model or not req.model.strip():
        raise HTTPException(status_code=400, detail="Model name is required.")

    messages_data = [m.model_dump() for m in req.messages]
    sources = []

    # If Web Search is requested, search DuckDuckGo and augment context
    if req.web_search:
        search_query = ""
        for m in reversed(req.messages):
            if m.role == "user":
                if isinstance(m.content, str):
                    search_query = m.content
                elif isinstance(m.content, list):
                    for part in m.content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            search_query = part.get("text", "")
                            break
                break

        if search_query.strip():
            logger.info(f"Web search activated for query: '{search_query.strip()}'")
            try:
                sources = await search_duckduckgo(search_query.strip(), max_results=5)
            except Exception as e:
                logger.error(f"Web search failed: {e}")

            if sources:
                sources_text = "\n\n".join([
                    f"[{idx+1}] Manba: {s['title']} ({s['url']})\n{s['snippet']}"
                    for idx, s in enumerate(sources)
                ])
                web_instruction = (
                    f"[Internetdan olingan eng so'nggi ma'lumotlar (Web Search Results)]:\n"
                    f"{sources_text}\n\n"
                    f"Yo'riqnoma: Yuqoridagi internet qidiruvi ma'lumotlariga tayangan holda foydalanuvchining savoliga aniq va to'liq javob bering. "
                    f"Matnda keltirilgan ma'lumotlar qaysi manbadan olinganini [1], [2] kabi ko'rsatkichlar bilan ifodalang."
                )

                has_system = False
                for m in messages_data:
                    if m["role"] == "system":
                        m["content"] = str(m["content"]) + f"\n\n{web_instruction}"
                        has_system = True
                        break
                if not has_system:
                    messages_data.insert(0, {"role": "system", "content": web_instruction})

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
