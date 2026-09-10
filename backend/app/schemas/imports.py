from pydantic import BaseModel


class BulkImportResult(BaseModel):
    """Outcome of an Excel bulk-create import."""

    created: int = 0
    skipped: int = 0  # blank or already-existing rows
    errors: list[str] = []  # human-readable per-row problems (capped)
