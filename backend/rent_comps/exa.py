"""
Fetch mukim-level rental comps via the Exa Search API.

Calls POST https://api.exa.ai/search with a structured ``outputSchema`` so Exa
researches live Malaysian rental listings and returns aggregate monthly-rent
statistics as JSON. Contract per
https://exa.ai/docs/reference/search-api-guide-for-coding-agents:
  - request: ``query`` / ``type`` / ``systemPrompt`` / ``outputSchema`` at the
    top level; content params nested under ``contents``
  - response: synthesized JSON in ``output.content`` when ``outputSchema`` is set
  - auth: the ``x-api-key`` header

Requires EXA_API_KEY in backend/.env. Optional env vars:
  EXA_TYPE        search type (default "deep"; deep variants synthesise best —
                  auto | fast | deep-lite | deep | deep-reasoning)
  EXA_TIMEOUT_MS  HTTP timeout in milliseconds (default 180000)
"""
import json
import os
import statistics
from datetime import datetime, timezone

import httpx

from .context import RentContext
from .schema import RentEstimate

EXA_SEARCH_URL = "https://api.exa.ai/search"

# outputSchema must stay inside Exa's documented limits: max nesting depth 2,
# max 10 total properties, and NO citation/confidence fields (Exa supplies
# grounding itself; we derive confidence locally in _confidence()).
OUTPUT_SCHEMA = {
    "type": "object",
    "required": ["avg_rent_myr", "median_rent_myr", "listing_count"],
    "properties": {
        "avg_rent_myr": {"type": ["number", "null"], "description": "Average monthly rent in MYR (RM) across comparable whole-unit listings"},
        "min_rent_myr": {"type": ["number", "null"], "description": "Lowest comparable monthly rent in MYR"},
        "max_rent_myr": {"type": ["number", "null"], "description": "Highest comparable monthly rent in MYR"},
        "median_rent_myr": {"type": ["number", "null"], "description": "Median monthly rent in MYR"},
        "listing_count": {"type": "integer", "minimum": 0, "description": "Number of distinct rental listings the figures are based on"},
        "sources_used": {"type": "array", "items": {"type": "string"}, "description": "Website domains the listings came from, e.g. iproperty.com.my"},
        "sample_listings": {
            "type": "array",
            "description": "Up to 5 example listings backing the estimate",
            "items": {
                "type": "object",
                "properties": {
                    "rent_myr": {"type": "number", "description": "Monthly rent in MYR"},
                    "source": {"type": "string", "description": "Portal or website name"},
                    "url": {"type": "string", "description": "Listing URL"},
                },
            },
        },
    },
}

SYSTEM_PROMPT = (
    "You are a Malaysian residential property rental analyst. Using current "
    "rental listings, report the MONTHLY rent in Malaysian Ringgit (MYR/RM) for "
    "the requested area. Prefer Malaysian portals such as iproperty.com.my, "
    "propertyguru.com.my and mudah.my. Use only whole-unit residential rentals "
    "- exclude room-only, bedspace and partition rentals, and ignore sale "
    "(purchase) prices. Collapse duplicate listings before aggregating."
)


def call_exa(ctx: RentContext) -> RentEstimate:
    api_key = os.environ.get("EXA_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("EXA_API_KEY not set")

    search_type = os.environ.get("EXA_TYPE", "deep").strip() or "deep"
    timeout_s = max(5.0, int(os.environ.get("EXA_TIMEOUT_MS", "180000")) / 1000)

    payload = {
        "query": ctx.exa_query(),
        "type": search_type,
        "numResults": 10,
        "systemPrompt": SYSTEM_PROMPT,
        "outputSchema": OUTPUT_SCHEMA,
        "contents": {"highlights": True},
    }
    headers = {"x-api-key": api_key, "Content-Type": "application/json"}

    try:
        resp = httpx.post(EXA_SEARCH_URL, json=payload, headers=headers, timeout=timeout_s)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return _fallback(ctx, f"Exa search failed: {e}")

    output = data.get("output") if isinstance(data, dict) else None
    content = output.get("content") if isinstance(output, dict) else None
    # output.content is an object when outputSchema is set, but tolerate a
    # JSON-encoded string just in case.
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except (ValueError, TypeError):
            content = None
    if not isinstance(content, dict):
        return _fallback(ctx, "Exa returned no structured output")

    return _map_response(ctx, content)


def _num(v) -> float | None:
    if v is None:
        return None
    try:
        return float(str(v).replace(",", "").replace("RM", "").strip())
    except (TypeError, ValueError):
        return None


def _confidence(listing_count: int, sources_used: list[str], stated: str | None) -> str:
    if stated in {"high", "medium", "low", "none"}:
        return stated
    if listing_count >= 15 and len(sources_used) >= 2:
        return "high"
    if listing_count >= 8:
        return "medium"
    if listing_count > 0:
        return "low"
    return "none"


def _map_response(ctx: RentContext, data: dict) -> RentEstimate:
    now = datetime.now(timezone.utc).isoformat()

    listing_count = int(data.get("listing_count") or 0)
    sources_used = [str(s) for s in (data.get("sources_used") or []) if s]
    sample_listings = data.get("sample_listings") or []

    prices = []
    for item in sample_listings:
        if isinstance(item, dict):
            v = _num(item.get("rent_myr"))
            if v is not None and 200 <= v <= 30_000:
                prices.append(v)

    avg = _num(data.get("avg_rent_myr"))
    median = _num(data.get("median_rent_myr"))
    mn = _num(data.get("min_rent_myr"))
    mx = _num(data.get("max_rent_myr"))

    if prices and listing_count > 0:
        prices_sorted = sorted(prices)
        avg = avg or round(sum(prices_sorted) / len(prices_sorted))
        median = median or float(statistics.median(prices_sorted))
        mn = mn or prices_sorted[0]
        mx = mx or prices_sorted[-1]

    if listing_count == 0:
        return _fallback(ctx, data.get("notes") or "Exa found no rental listings")

    return RentEstimate(
        mukim=data.get("mukim") or ctx.mukim,
        avg_rent_myr=avg,
        min_rent_myr=mn,
        max_rent_myr=mx,
        median_rent_myr=median,
        listing_count=listing_count,
        sources_used=sources_used,
        confidence=_confidence(listing_count, sources_used, data.get("confidence")),
        fetched_at=now,
        notes=data.get("notes") or "via Exa Search",
        sample_listings=sample_listings[:5],
    )


def _fallback(ctx: RentContext, notes: str) -> RentEstimate:
    return RentEstimate(
        mukim=ctx.mukim,
        avg_rent_myr=None,
        min_rent_myr=None,
        max_rent_myr=None,
        median_rent_myr=None,
        listing_count=0,
        sources_used=[],
        confidence="none",
        fetched_at=datetime.now(timezone.utc).isoformat(),
        notes=notes,
        sample_listings=[],
    )
