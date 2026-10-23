"""Convenience runner script for BrandGraph AI."""

import uvicorn
import webbrowser
import threading
import time


def open_browser():
    time.sleep(1.2)
    try:
        webbrowser.open("http://localhost:8000")
    except Exception:
        pass


if __name__ == "__main__":
    print("=" * 65)
    print("  🚀 BrandGraph AI — Inkloom AI Brand Governance Platform")
    print("  Server running at: http://localhost:8000")
    print("  API Documentation: http://localhost:8000/docs")
    print("=" * 65)

    threading.Thread(target=open_browser, daemon=True).start()
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)
