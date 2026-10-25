"""Localized header labels for downloaded Excel templates.

The header (first) row of every generated template is translated into the
language configured on the admin panel (`company_settings.excel_lang`). Only
the header row is localized; example rows and Guide sheets stay as-is.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.setting import CompanySettings

# English canonical header -> {ru, uz}. English is the fallback (the key itself).
_HEADERS: dict[str, dict[str, str]] = {
    "SKU": {"ru": "Артикул", "uz": "Artikul"},
    "Name": {"ru": "Название", "uz": "Nomi"},
    "Category": {"ru": "Категория", "uz": "Kategoriya"},
    "Unit": {"ru": "Ед. изм.", "uz": "Birlik"},
    "Cost price": {"ru": "Себестоимость", "uz": "Tannarx"},
    "Sale price": {"ru": "Цена продажи", "uz": "Sotuv narxi"},
    "Min stock": {"ru": "Мин. остаток", "uz": "Min. qoldiq"},
    "Currency": {"ru": "Валюта", "uz": "Valyuta"},
    "Sale mode (piece/box/both)": {
        "ru": "Продажа (piece/box/both)",
        "uz": "Sotuv (piece/box/both)",
    },
    "Box qty": {"ru": "Штук в коробке", "uz": "Qutidagi dona"},
    "Box weight": {"ru": "Вес коробки", "uz": "Quti vazni"},
    "Box dimensions": {"ru": "Размеры коробки", "uz": "Quti o'lchamlari"},
    "Initial stock": {"ru": "Начальный остаток", "uz": "Boshlang'ich qoldiq"},
    "Whole units? (yes/no)": {"ru": "Целыми? (yes/no)", "uz": "Butun? (yes/no)"},
    "Phone": {"ru": "Телефон", "uz": "Telefon"},
    "Address": {"ru": "Адрес", "uz": "Manzil"},
    "City": {"ru": "Город", "uz": "Shahar"},
    "Region": {"ru": "Регион", "uz": "Hudud"},
    "Credit limit": {"ru": "Кредитный лимит", "uz": "Kredit limiti"},
    "Visit days (mon,wed,fri)": {
        "ru": "Дни визита (mon,wed,fri)",
        "uz": "Tashrif kunlari (mon,wed,fri)",
    },
    "Agent (name or email)": {
        "ru": "Агент (ФИО или email)",
        "uz": "Agent (F.I.Sh yoki email)",
    },
    "Product ID": {"ru": "ID товара", "uz": "Tovar ID"},
    "Available stock": {"ru": "Остаток на складе", "uz": "Ombordagi qoldiq"},
    "Add quantity": {"ru": "Добавить количество", "uz": "Miqdor qo'shish"},
    "In stock": {"ru": "На складе", "uz": "Omborda"},
    "Quantity": {"ru": "Количество", "uz": "Miqdor"},
    "Unit cost": {"ru": "Цена закупки", "uz": "Xarid narxi"},
}


def h(header: str, lang: str) -> str:
    """One localized header (falls back to the English key)."""
    return _HEADERS.get(header, {}).get(lang, header)


def headers(cols: list[str], lang: str) -> list[str]:
    """Localize a whole header row."""
    return [h(c, lang) for c in cols]


async def excel_lang(db: AsyncSession) -> str:
    """The admin-configured Excel header language ('ru' by default)."""
    lang = await db.scalar(select(CompanySettings.excel_lang).limit(1))
    return lang or "ru"
