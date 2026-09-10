from fastapi import APIRouter

from app.api.routers import (
    activity,
    agents,
    auth,
    cash,
    catalog,
    currencies,
    customers,
    finance,
    inventory,
    meta,
    photo_reports,
    products,
    purchasing,
    regions,
    reports,
    returns,
    sales_orders,
    telegram_topics,
    users,
)

api_router = APIRouter()
api_router.include_router(meta.router)
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(catalog.router)
api_router.include_router(currencies.router)
api_router.include_router(products.router)
api_router.include_router(customers.router)
api_router.include_router(regions.router)
api_router.include_router(inventory.router)
api_router.include_router(purchasing.router)
api_router.include_router(sales_orders.router)
api_router.include_router(finance.router)
api_router.include_router(cash.router)
api_router.include_router(returns.router)
api_router.include_router(agents.router)
api_router.include_router(telegram_topics.router)
api_router.include_router(photo_reports.router)
api_router.include_router(activity.router)
api_router.include_router(reports.router)
