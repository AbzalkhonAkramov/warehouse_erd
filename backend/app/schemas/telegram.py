from pydantic import BaseModel, ConfigDict


class TopicBase(BaseModel):
    name: str
    chat_id: int
    message_thread_id: int | None = None
    is_active: bool = True
    is_default: bool = False


class TopicCreate(TopicBase):
    pass


class TopicUpdate(BaseModel):
    name: str | None = None
    chat_id: int | None = None
    message_thread_id: int | None = None
    is_active: bool | None = None
    is_default: bool | None = None


class TopicOut(TopicBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class TelegramUpdateHint(BaseModel):
    """A simplified getUpdates row to help admins find chat_id / topic ids."""

    chat_id: int | None = None
    chat_title: str | None = None
    chat_type: str | None = None
    message_thread_id: int | None = None
    topic_name: str | None = None
    text: str | None = None
