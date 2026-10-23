"""Optional AI Review Engine with Provider Interface for BrandGraph AI."""

from enum import Enum
import json
import os
from typing import Dict, List, Optional
import requests

from backend.schemas import (
    AIReviewResponse,
    Finding,
    Severity,
    EvidenceStatus,
    SearchResult,
)


class ProviderStatus(str, Enum):
    DISABLED = "Disabled (Local Mode)"
    UNCONFIGURED = "Unconfigured (No API Key)"
    READY = "Ready"
    ERROR = "Connection Error"


class AIReviewService:
    """Manages optional external LLM provider calls with strict schema validation and safe offline fallbacks."""

    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "none").lower()
        self.api_key = os.getenv("AI_API_KEY", "")
        self.model_name = os.getenv("AI_MODEL_NAME", "gpt-4o-mini")
        self.timeout = int(os.getenv("AI_REQUEST_TIMEOUT_SECONDS", "15"))
        self.allow_external = os.getenv("ALLOW_EXTERNAL_AI_CALLS", "false").lower() in ("true", "1", "yes")

    def get_provider_status(self) -> Dict[str, str]:
        if not self.allow_external or self.provider == "none":
            return {
                "status": ProviderStatus.DISABLED.value,
                "provider": "Local Offline Engine",
                "model": "None (Deterministic & RAG Mode)",
                "message": "External AI network calls are disabled. Content is kept 100% local and private.",
            }
        if not self.api_key or not self.api_key.strip():
            return {
                "status": ProviderStatus.UNCONFIGURED.value,
                "provider": self.provider.title(),
                "model": self.model_name,
                "message": "AI Provider is selected but AI_API_KEY is not set. Operating in local mode.",
            }
        return {
            "status": ProviderStatus.READY.value,
            "provider": self.provider.title(),
            "model": self.model_name,
            "message": f"Connected to {self.provider.title()} for tone and messaging analysis.",
        }

    def review(
        self,
        content: str,
        retrieved_evidence: List[SearchResult],
    ) -> Optional[AIReviewResponse]:
        status = self.get_provider_status()
        if status["status"] != ProviderStatus.READY.value:
            return None

        evidence_context = "\n".join([
            f"- [{r.source_id}] ({r.source_title}): {r.text}"
            for r in retrieved_evidence
        ]) or "No specific evidence sources matched."

        prompt = f"""You are BrandGraph AI, an expert brand governance analyzer.
Evaluate the following draft content for:
1. Tone and voice alignment (Brand voice is: Professional, measured, transparent, non-hyperbolic).
2. Potentially unsupported promotional claims or messaging inconsistencies.
3. Suggest clear rewrites where applicable.

RULES:
- Reference ONLY real source IDs present in the provided evidence.
- If a claim has no evidence in the provided sources, mark evidence_status as 'Needs verification'.
- Never declare a claim false unless the approved evidence directly contradicts it.
- Return ONLY valid JSON adhering strictly to the schema.

APPROVED EVIDENCE:
{evidence_context}

DRAFT CONTENT:
\"\"\"{content}\"\"\"

JSON SCHEMA:
{{
  "tone_and_voice_assessment": "Summary of tone alignment",
  "findings": [
    {{
      "category": "tone_voice" | "unsupported_claim" | "policy_violation",
      "matched_text": "quoted snippet from draft",
      "explanation": "why this needs attention",
      "suggested_action": "recommended step",
      "suggested_rewrite": "optional improved wording",
      "evidence_source_id": "SRC-xxx or null",
      "evidence_status": "supported" | "contradicted" | "Needs verification",
      "confidence_score": 0.85
    }}
  ],
  "overall_recommendation": "Final editorial recommendation"
}}
"""

        try:
            if self.provider == "openai":
                return self._call_openai(prompt)
            elif self.provider == "gemini":
                return self._call_gemini(prompt)
            return None
        except Exception:
            # Safe non-blocking fallback
            return None

    def _call_openai(self, prompt: str) -> Optional[AIReviewResponse]:
        url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model_name,
            "messages": [
                {"role": "system", "content": "You are a brand governance engine that outputs structured JSON."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.2,
        }
        res = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
        if res.status_code == 200:
            data = res.json()
            raw_json = data["choices"][0]["message"]["content"]
            parsed = json.loads(raw_json)
            return AIReviewResponse.model_validate(parsed)
        return None

    def _call_gemini(self, prompt: str) -> Optional[AIReviewResponse]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"response_mime_type": "application/json"},
        }
        res = requests.post(url, json=payload, timeout=self.timeout)
        if res.status_code == 200:
            data = res.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            parsed = json.loads(raw_text)
            return AIReviewResponse.model_validate(parsed)
        return None

    def convert_ai_findings_to_findings(
        self,
        ai_response: AIReviewResponse,
    ) -> List[Finding]:
        unified: List[Finding] = []
        for idx, af in enumerate(ai_response.findings):
            unified.append(
                Finding(
                    id=f"FIND-AI-{idx+1:03d}",
                    category=af.category,
                    matched_text=af.matched_text,
                    rule_id=None,
                    rule_description="AI-Assisted Tone & Consistency Analysis",
                    severity=Severity.MEDIUM,
                    explanation=af.explanation,
                    suggested_action=af.suggested_action,
                    suggested_rewrite=af.suggested_rewrite,
                    evidence_source_id=af.evidence_source_id,
                    evidence_status=af.evidence_status,
                    is_ai_assisted=True,
                )
            )
        return unified
