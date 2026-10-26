# ruff: noqa: E402
from typing import Any
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import NullPool

_STRIPPED_PARAMS = frozenset(
    {"pgbouncer", "supa", "uselibpqcompat", "options", "channel_binding", "gssencmode"}
)

def build_supabase_async_engine(raw_database_url: str, is_serverless: bool = True):
    """Configures a robust SQLAlchemy async engine for Supabase PostgreSQL and poolers."""
    url = make_url(raw_database_url)
    query = dict(url.query)
    connect_args: dict[str, Any] = {}

    # Strip incompatible libpq parameters from asyncpg URL
    for key in _STRIPPED_PARAMS:
        query.pop(key, None)

    sslmode = query.pop("sslmode", None)
    if sslmode and "ssl" not in query:
        connect_args["ssl"] = False if str(sslmode).lower() == "disable" else "require"

    clean_url = url.set(query=query).render_as_string(hide_password=False)

    # Transaction pooler (Port 6543) requires statement_cache_size = 0
    if is_serverless or url.port == 6543 or "pooler.supabase.com" in (url.host or ""):
        connect_args["statement_cache_size"] = 0

    engine_kwargs: dict[str, Any] = {
        "echo": False,
        "connect_args": connect_args,
    }

    # In serverless runtimes (e.g. Vercel), use NullPool to avoid connection leaks
    if is_serverless:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10

    engine = create_async_engine(clean_url, **engine_kwargs)
    session_factory = async_sessionmaker(
        engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )
    return engine, session_factory
