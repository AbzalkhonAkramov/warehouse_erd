"""Alphabetic reference codes: <letters><5-digit number>.

The letters advance alphabetically (A, B, … Z, AA, AB, …) and the number cycles
00001–99999; each full number cycle bumps the letters to the next combination.

Starting letter length is per entity:
    SKU       -> 1 letter  (A00001, A00002, … Z99999, AA00001, …)
    incoming  -> 2 letters (AA00001, AA00002, …)
    order     -> 3 letters (AAA00001, AAA00002, …)
"""

_ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
# Bijective-base-26 index of the smallest string of each length ("A", "AA", "AAA").
_BASE_OFFSET = {1: 1, 2: 27, 3: 703}
_DIGITS = 5
_CYCLE = 10**_DIGITS - 1  # 99999 numbers per letter combination


def _to_bijective(n: int) -> str:
    """1 -> A, 26 -> Z, 27 -> AA, 703 -> AAA, …"""
    out = ""
    while n > 0:
        n, r = divmod(n - 1, 26)
        out = _ALPHA[r] + out
    return out


def format_ref(seq: int, min_letters: int) -> str:
    """Map a 1-based sequence number to '<letters><NNNNN>'."""
    seq = max(seq, 1)
    combo = (seq - 1) // _CYCLE
    num = (seq - 1) % _CYCLE + 1
    letters = _to_bijective(_BASE_OFFSET.get(min_letters, 1) + combo)
    return f"{letters}{num:0{_DIGITS}d}"
