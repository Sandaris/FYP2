from dataclasses import dataclass
import re

# Common NAPIC dataset abbreviations → full Malay/English words.
# Applied only when building the Exa search query so the AI can recognise
# the location; the stored scheme name is kept as-is.
_NAPIC_ABBREVS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\bBDR\b', re.IGNORECASE), 'Bandar'),
    (re.compile(r'\bTMN\b', re.IGNORECASE), 'Taman'),
    (re.compile(r'\bKG\b', re.IGNORECASE), 'Kampung'),
    (re.compile(r'\bSG\b', re.IGNORECASE), 'Sungai'),
    (re.compile(r'\bBT\b', re.IGNORECASE), 'Bukit'),
    (re.compile(r'\bJLN\b', re.IGNORECASE), 'Jalan'),
    (re.compile(r'\bHTS\b', re.IGNORECASE), 'Heights'),
    (re.compile(r'\bGDN\b', re.IGNORECASE), 'Garden'),
    (re.compile(r'\bVLG\b', re.IGNORECASE), 'Village'),
    (re.compile(r'\bPERMAI\b', re.IGNORECASE), 'Permai'),
    (re.compile(r'\bPRM\b', re.IGNORECASE), 'Permai'),
    (re.compile(r'\bSRI\b', re.IGNORECASE), 'Sri'),
    (re.compile(r'\bRES\b', re.IGNORECASE), 'Residensi'),
]


def _expand_napic(text: str) -> str:
    """Expand uppercase NAPIC abbreviations to readable words."""
    for pattern, replacement in _NAPIC_ABBREVS:
        text = pattern.sub(replacement, text)
    return text


@dataclass(frozen=True)
class RentContext:
    mukim: str
    scheme: str | None = None
    district: str | None = None
    state: str | None = None
    property_type: str | None = None

    @classmethod
    def from_kwargs(
        cls,
        mukim: str,
        *,
        scheme: str | None = None,
        district: str | None = None,
        state: str | None = None,
        property_type: str | None = None,
    ) -> "RentContext":
        def clean(v: str | None) -> str | None:
            if v is None:
                return None
            s = str(v).strip()
            return s or None

        return cls(
            mukim=clean(mukim) or mukim.strip(),
            scheme=clean(scheme),
            district=clean(district),
            state=clean(state),
            property_type=clean(property_type),
        )

    def cache_slug(self) -> str:
        # Use the expanded location so a scheme like "BDR UTAMA" gets a
        # separate cache slot from "Bandar Utama" (different Exa query).
        expanded = _expand_napic(self.location_label())
        parts = [expanded, self.property_type]
        raw = "|".join(p for p in parts if p)
        slug = raw.lower()
        slug = re.sub(r"[^a-z0-9]+", "_", slug)
        return slug.strip("_") or "unknown"

    def location_label(self) -> str:
        bits = [b for b in (self.scheme, self.mukim, self.district, self.state) if b]
        return ", ".join(bits)

    def exa_query(self) -> str:
        location = _expand_napic(self.location_label())
        lines = [
            f"Find current residential rental market prices in Malaysia for: {location}.",
        ]
        if self.property_type:
            lines.append(
                f'Focus on comparable whole-unit rentals matching property type "{self.property_type}". '
                "Exclude room-only, bedspace, and partition rentals."
            )
        else:
            lines.append(
                "Focus on whole-unit residential rentals. "
                "Exclude room-only, bedspace, and partition rentals."
            )
        lines.append(
            "Return aggregate monthly rent statistics (min, max, average, median) from live listing data."
        )
        return " ".join(lines)
