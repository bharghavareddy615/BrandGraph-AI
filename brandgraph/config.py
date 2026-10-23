"""Configuration and settings for BrandGraph AI."""

from dataclasses import dataclass
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

@dataclass(frozen=True)
class AppConfig:
    """Application configuration container."""
    env: str = os.getenv("BRANDGRAPH_ENV", "development")
    db_path: str = os.getenv("BRANDGRAPH_DB_PATH", str(BASE_DIR / "brandgraph.sqlite"))
    ai_provider: str = os.getenv("AI_PROVIDER", "none").lower()
    ai_api_key: str = os.getenv("AI_API_KEY", "")
    ai_model_name: str = os.getenv("AI_MODEL_NAME", "gpt-4o-mini")
    ai_timeout: int = int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "15"))
    allow_external_ai: bool = os.getenv("ALLOW_EXTERNAL_AI_CALLS", "false").lower() in ("true", "1", "yes")
    enable_synthetic_banner: bool = os.getenv("ENABLE_SYNTHETIC_DATA_BANNER", "true").lower() in ("true", "1", "yes")
    app_title: str = "BrandGraph AI — Inkloom Brand Governance"
    version: str = "1.0.0"

config = AppConfig()
