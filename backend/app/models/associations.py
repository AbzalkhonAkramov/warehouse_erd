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

# Which agents are pinned to a market (shop). Many-to-many: a market can have
# several agents, and an agent can cover several markets.
customer_agents = Table(
    "customer_agents",
    Base.metadata,
    Column("customer_id", ForeignKey("customers.id", ondelete="CASCADE"), primary_key=True),
    Column("agent_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)

# Which Telegram topics an agent may send photo reports to. An agent with no rows
# here is unrestricted (may pick any active topic); add rows to restrict them.
agent_topics = Table(
    "agent_topics",
    Base.metadata,
    Column("agent_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("topic_id", ForeignKey("telegram_topics.id", ondelete="CASCADE"), primary_key=True),
)
