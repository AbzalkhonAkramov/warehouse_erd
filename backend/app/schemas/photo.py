from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import PhotoReportStatus, PhotoStage


class PhotoImageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    stage: PhotoStage
    # Deep link to the Telegram message (images are stored in Telegram only).
    telegram_link: str | None
    telegram_message_id: int | None = None


class PhotoReportOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    agent_id: int
    customer_id: int
    sales_order_id: int | None
    topic_id: int | None
    note: str | None
    status: PhotoReportStatus
    error: str | None
    created_at: datetime
    images: list[PhotoImageOut]
