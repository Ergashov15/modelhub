import os
import sys
import uvicorn
from dotenv import load_dotenv

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

if __name__ == "__main__":
    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    print("\n" + "=" * 56)
    print(">>> Qwen UI Server ishga tushmoqda...")
    print(f">>> Manzil: http://{host}:{port}")
    reload_val = os.getenv("RELOAD", "true").lower() in ("true", "1")
    uvicorn.run("backend.app.main:app", host=host, port=port, reload=reload_val)
