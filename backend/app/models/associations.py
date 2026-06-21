from sqlalchemy import Column, ForeignKey, Table

from app.models.base import Base

# Which product categories an agent is allowed to see/sell. An agent with no rows
# here is unrestricted (sees all products); add rows to restrict them.
agent_categories = Table(
    "agent_categories",
    Base.metadata,
    Column("agent_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("category_id", ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True),
)
