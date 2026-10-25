"""Convenience runner script for BrandGraph AI."""

import os
import uvicorn
import webbrowser
import threading
import time


def open_browser(port: int):
    time.sleep(1.2)
    try:
        webbrowser.open(f"http://localhost:{port}")
    except Exception:
        pass


if __name__ == "__main__":
    host = os.environ.get("HOST", "0.0.0.0")
    port = int(os.environ.get("PORT", "8000"))
    reload_env = os.environ.get("RELOAD", "").lower()
    reload = reload_env in ("true", "1") if reload_env else ("PORT" not in os.environ)

    print("=" * 65)
    print("  🚀 BrandGraph AI — Inkloom AI Brand Governance Platform")
    print(f"  Server running at: http://{host}:{port}")
    print(f"  API Documentation: http://{host}:{port}/docs")
    print("=" * 65)

    if "PORT" not in os.environ:
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    uvicorn.run("backend.main:app", host=host, port=port, reload=reload)

