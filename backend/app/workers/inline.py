"""Inline background task runners for serverless deployments (e.g., Vercel).

When Redis / arq workers are not used (``effective_job_queue_mode == "inline"``),
FastAPI ``BackgroundTasks`` runs these wrappers inside the request invocation
after the HTTP response is sent, reusing the exact worker job functions with
the app's ``async_session_maker``.
"""

import logging

from app.database import async_session_maker
from app.workers.background_removal import remove_item_background_job
from app.workers.rotation import rotate_item_image_job
from app.workers.tagging import TAGGING_MAX_TRIES, tag_item_image

logger = logging.getLogger(__name__)


def _inline_ctx() -> dict:
    return {
        "db_session_factory": async_session_maker,
        "job_try": TAGGING_MAX_TRIES,
    }


async def run_inline_tagging(item_id: str, image_path: str) -> None:
    try:
        await tag_item_image(_inline_ctx(), item_id, image_path)
    except Exception as e:
        logger.error("Inline AI tagging failed for item %s: %s", item_id, e)


async def run_inline_rotation(item_id: str, direction: str) -> None:
    try:
        await rotate_item_image_job(_inline_ctx(), item_id, direction)
    except Exception as e:
        logger.error("Inline image rotation failed for item %s: %s", item_id, e)


async def run_inline_background_removal(item_id: str, bg_color_hex: str) -> None:
    try:
        await remove_item_background_job(_inline_ctx(), item_id, bg_color_hex)
    except Exception as e:
        logger.error("Inline background removal failed for item %s: %s", item_id, e)
