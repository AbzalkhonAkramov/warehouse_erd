from pydantic import BaseModel, ConfigDict


class CurrencyBase(BaseModel):
    code: str          # UZS, USD
    name: str          # Uzbek som
    symbol: str        # so'm, $
    is_active: bool = True


class CurrencyCreate(CurrencyBase):
    pass


class CurrencyUpdate(BaseModel):
    code: str | None = None
    name: str | None = None
    symbol: str | None = None
    is_active: bool | None = None


class CurrencyOut(CurrencyBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
