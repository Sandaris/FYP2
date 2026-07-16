"""Household income lookup by district.

Data: DOSM Household Income and Basic Amenities Survey, district level.
Source file: fraud_report/income_dataset_2022/hh_income_district.csv
Years available: 2019, 2022.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

import pandas as pd

_CSV = Path(__file__).parent.parent / "fraud_report" / "income_dataset_2022" / "hh_income_district.csv"

# Maps district names as they appear in transactions.parquet → income dataset names.
# Only entries that differ are listed; everything else matches exactly.
_NORMALISE: dict[str, str] = {
    # Hulu vs Ulu spelling
    "Hulu Langat": "Ulu Langat",
    "Hulu Selangor": "Ulu Selangor",
    # Spelling variants
    "Kota Bahru": "Kota Bharu",
    "Cameron Highland": "Cameron Highlands",
    "Bandar Baru": "Bandar Baharu",
    "Larut Matang": "Larut dan Matang",
    # Federal territories stored without prefix in transactions
    "Kuala Lumpur": "W.P. Kuala Lumpur",
    "Labuan": "W.P. Labuan",
    "Putrajaya": "W.P. Putrajaya",
    # Sarawak divisions (Bahagian) → main district of that division
    "Bahagian Betong": "Betong",
    "Bahagian Bintulu": "Bintulu",
    "Bahagian Kapit": "Kapit",
    "Bahagian Kuching": "Kuching",
    "Bahagian Limbang": "Limbang",
    "Bahagian Miri": "Miri",
    "Bahagian Mukah": "Mukah",
    "Bahagian Samarahan": "Samarahan",
    "Bahagian Sarikei": "Sarikei",
    "Bahagian Sarikie": "Sarikei",   # typo variant in source data
    "Bahagian Serian": "Serian",
    "Bahagian Sibu": "Sibu",
    "Bahagian Sri Aman": "Sri Aman",
}


@lru_cache(maxsize=1)
def _load() -> pd.DataFrame:
    df = pd.read_csv(_CSV, parse_dates=["date"])
    return df


def normalise_district(district: str) -> str:
    """Return the income-dataset district name for a given transaction district."""
    return _NORMALISE.get(district, district)


# Income dataset spells some states differently than the rest of the app.
_STATE_NAME_FIX: dict[str, str] = {
    "Pulau Pinang": "Penang",
    "W.P. Kuala Lumpur": "Kuala Lumpur",
    "W.P. Labuan": "Labuan",
    "W.P. Putrajaya": "Putrajaya",
}

# Two transactions.parquet districts too small to appear in the income dataset
# (7 and 18 rows respectively) — mapped to their state by hand.
_STATE_OVERRIDES: dict[str, str] = {
    "DAERAH KECIL MUADZAM SHAH": "Pahang",
    "Labuk Sugut": "Sabah",
}


@lru_cache(maxsize=1)
def district_state_map() -> dict[str, str]:
    """Map every transactions.parquet District value to its state name.

    Built from the income dataset's district->state columns (via the same
    normalisation used by get_income), plus manual overrides for the couple
    of districts too small to appear there.
    """
    income = _load()[["district", "state"]].drop_duplicates()
    by_income_name = {
        row["district"]: _STATE_NAME_FIX.get(row["state"], row["state"])
        for _, row in income.iterrows()
    }
    mapping = dict(by_income_name)
    for txn_name, income_name in _NORMALISE.items():
        if income_name in by_income_name:
            mapping[txn_name] = by_income_name[income_name]
    mapping.update(_STATE_OVERRIDES)
    return mapping


def get_income(district: str, year: int = 2022) -> dict | None:
    """Return income stats for a district, or None if not found.

    Returns a dict with keys: district, state, year, income_mean, income_median.
    Falls back to the closest available year if the requested year is absent.
    """
    df = _load()
    name = normalise_district(district)
    rows = df[df["district"] == name].copy()
    if rows.empty:
        return None

    rows = rows.sort_values("date")
    available_years = rows["date"].dt.year.tolist()
    chosen_year = min(available_years, key=lambda y: abs(y - year))
    row = rows[rows["date"].dt.year == chosen_year].iloc[0]

    return {
        "district": name,
        "state": row["state"],
        "year": chosen_year,
        "income_mean": int(row["income_mean"]),
        "income_median": int(row["income_median"]),
    }
