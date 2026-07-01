from pydantic import BaseModel, ConfigDict

from app.models.enums import UserRole


class UserBase(BaseModel):
    full_name: str
    # Plain str (not EmailStr): internal ERP accounts may use non-deliverable
    # or reserved domains (e.g. *.local), which EmailStr rejects.
    email: str
    phone: str | None = None
    role: UserRole = UserRole.AGENT
    telegram_chat_id: str | None = None
    default_topic_id: int | None = None
    # Admin "important" flag: this agent's orders need before/after photos.
    photo_required: bool = True


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    role: UserRole | None = None
    is_active: bool | None = None
    telegram_chat_id: str | None = None
    default_topic_id: int | None = None
    photo_required: bool | None = None
    password: str | None = None


class UserOut(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    is_active: bool
    reset_requested: bool = False


class AgentCategoriesUpdate(BaseModel):
    category_ids: list[int]


class AgentTopicsUpdate(BaseModel):
    topic_ids: list[int]


class AgentTopicOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
