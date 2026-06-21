from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int | None
    user_name: str | None = None
    method: str
    path: str
    action: str
    detail: str | None = None
    status_code: int
    created_at: datetime
