import hashlib
import hmac
import time

from app.config import get_settings

DEFAULT_EXPIRY_SECONDS = 3600


def _get_image_signing_key() -> bytes:
    settings = get_settings()
    return hmac.new(settings.secret_key.encode(), b"image-url-signing", hashlib.sha256).digest()


def sign_image_url(path: str, expiry_seconds: int = DEFAULT_EXPIRY_SECONDS) -> str:
    settings = get_settings()
    if settings.supabase_storage_configured and settings.storage_backend in ("supabase", "auto"):
        clean_path = path.replace("\\", "/").lstrip("/")
        return f"{settings.supabase_url}/storage/v1/object/public/{settings.supabase_storage_bucket}/{clean_path}"

    expires = int(time.time()) + expiry_seconds

    message = f"{path}:{expires}"
    signature = hmac.new(_get_image_signing_key(), message.encode(), hashlib.sha256).hexdigest()[
        :32
    ]

    backend_base = (getattr(settings, "backend_url", None) or "https://forme-api.hassankarasu.dev").rstrip("/")
    return f"{backend_base}/api/v1/images/{path}?expires={expires}&sig={signature}"


def sign_optional(path: str | None, fallback: str | None = None) -> str | None:
    target = path or fallback
    return sign_image_url(target) if target else None


def verify_signature(path: str, expires: str, signature: str) -> bool:
    try:
        expiry_time = int(expires)
        if time.time() > expiry_time:
            return False
    except (ValueError, TypeError):
        return False

    message = f"{path}:{expires}"
    expected_signature = hmac.new(
        _get_image_signing_key(), message.encode(), hashlib.sha256
    ).hexdigest()[:32]

    return hmac.compare_digest(signature, expected_signature)
