from collections.abc import AsyncGenerator
from typing import Annotated, Any

from fastapi import Depends
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import Settings, get_settings

_STRIPPED_ASYNC_URL_PARAMS = frozenset(
    {"pgbouncer", "supa", "uselibpqcompat", "options", "channel_binding", "gssencmode"}
)


def prepare_async_engine_config(raw_url: str, cfg: Settings | Any) -> tuple[str, dict[str, Any]]:
    """Sanitize PostgreSQL 18 / Supabase URL for asyncpg and build SQLAlchemy engine kwargs.

    Handles Supabase / Supavisor transaction pooler and PostgreSQL 18 libpq URLs
    (stripping libpq-only query params like ``pgbouncer=true`` and ``channel_binding``,
    preserving PostgreSQL 18 ``sslnegotiation=direct`` with TLS enabled, mapping
    ``sslmode`` for asyncpg, disabling asyncpg prepared statement caching on
    poolers/serverless, and switching to ``NullPool`` in serverless runtimes).
    """
    url = make_url(raw_url)
    query = dict(url.query)
    connect_args: dict[str, Any] = {}

    for key in _STRIPPED_ASYNC_URL_PARAMS:
        query.pop(key, None)

    sslmode = query.pop("sslmode", None)
    if sslmode and "ssl" not in query:
        if str(sslmode).lower() == "disable":
            connect_args["ssl"] = False
            query.pop("sslnegotiation", None)
        else:
            query["ssl"] = "require" if str(sslmode).lower() == "prefer" else str(sslmode)
    elif (
        str(query.get("sslnegotiation", "")).lower() == "direct"
        and "ssl" not in query
        and "ssl" not in connect_args
    ):
        query["ssl"] = "require"

    clean_url = url.set(query=query).render_as_string(hide_password=False)

    is_serverless = getattr(cfg, "is_serverless", False) is True
    explicit_cache_size = getattr(cfg, "db_statement_cache_size", None)
    if isinstance(explicit_cache_size, int) and not isinstance(explicit_cache_size, bool):
        connect_args["statement_cache_size"] = explicit_cache_size
    elif is_serverless or url.port == 6543 or "pooler.supabase.com" in (url.host or ""):
        connect_args["statement_cache_size"] = 0

    engine_kwargs: dict[str, Any] = {
        "echo": bool(getattr(cfg, "database_echo", False)),
    }
    if connect_args:
        engine_kwargs["connect_args"] = connect_args

    if is_serverless:
        engine_kwargs["poolclass"] = NullPool
    else:
        engine_kwargs["pool_pre_ping"] = True
        engine_kwargs["pool_size"] = 5
        engine_kwargs["max_overflow"] = 10

    return clean_url, engine_kwargs


settings = get_settings()

# Create async engine
_db_url, _engine_kwargs = prepare_async_engine_config(str(settings.database_url), settings)
engine = create_async_engine(_db_url, **_engine_kwargs)

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""

    pass


async def get_db() -> AsyncGenerator[AsyncSession]:
    """Dependency that provides a database session."""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# scope="function" so that the commit runs before the response is sent: with the default
# request scope a client could act on a 200 before its writes are visible, and a failed
# commit could no longer turn that 200 into an error.
DbSession = Annotated[AsyncSession, Depends(get_db, scope="function")]
