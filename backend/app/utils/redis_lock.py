import logging
from contextlib import asynccontextmanager

import redis.asyncio as aioredis

from app.config import get_settings

logger = logging.getLogger(__name__)

_redis_pool: aioredis.Redis | None = None


class RedisDisabledError(aioredis.RedisError):
    """Raised when Redis is disabled (e.g., serverless mode without REDIS_URL)."""


async def get_redis() -> aioredis.Redis:
    settings = get_settings()
    if not settings.redis_enabled:
        raise RedisDisabledError("Redis is disabled in current configuration")
    global _redis_pool
    if _redis_pool is None:
        _redis_pool = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
    return _redis_pool


@asynccontextmanager
async def distributed_lock(key: str, timeout: int = 10, blocking_timeout: int = 5):
    if not get_settings().redis_enabled:
        yield
        return
    r = await get_redis()
    lock = r.lock(key, timeout=timeout, blocking_timeout=blocking_timeout)
    acquired = False
    try:
        acquired = await lock.acquire()
        if not acquired:
            raise TimeoutError(f"Could not acquire lock: {key}")
        yield
    finally:
        if acquired:
            try:
                await lock.release()
            except aioredis.exceptions.LockNotOwnedError:
                logger.warning("Lock %s already released (expired?)", key)
