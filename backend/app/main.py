# ruff: noqa: E402
import logging
import sys
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from pathlib import Path

# Add project root to sys.path so 'app.*' imports work cleanly in serverless runtimes (e.g. Vercel)
_root_dir = Path(__file__).resolve().parent.parent
if str(_root_dir) not in sys.path:
    sys.path.insert(0, str(_root_dir))

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import ValidationError

from app.api.router import api_router
from app.config import Settings, get_settings
from app.database import engine
from app.logging_config import configure_logging

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    configure_logging(settings)
    try:
        warning = settings.validate_security()
        if warning:
            logger.error("Configuration: %s", warning)
        logger.info("Auth mode: %s", settings.get_auth_mode())
    except Exception as exc:
        logger.critical("Configuration / Security error on startup: %s", exc, exc_info=True)
        if not settings.is_serverless:
            raise
    yield
    await engine.dispose()


def docs_urls(settings: Settings) -> dict[str, str | None]:
    enabled = settings.enable_docs if settings.enable_docs is not None else settings.dev_mode
    return {
        "docs_url": "/docs" if enabled else None,
        "redoc_url": "/redoc" if enabled else None,
        "openapi_url": "/openapi.json" if enabled else None,
    }


app = FastAPI(
    title=settings.app_name,
    description="AI-powered wardrobe management and outfit recommendations",
    version="1.0.0",
    lifespan=lifespan,
    **docs_urls(settings),
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

# Enable GZip compression for responses > 500 bytes
app.add_middleware(GZipMiddleware, minimum_size=500)
# Normalize path for serverless rewrites (e.g. Vercel)
@app.middleware("http")
async def normalize_serverless_path(request: Request, call_next):
    from urllib.parse import parse_qs, urlencode

    raw_qs = request.scope.get("query_string", b"").decode("utf-8")
    original_path = None

    if "__vercel_path" in raw_qs:
        parsed = parse_qs(raw_qs)
        raw_vp = parsed.pop("__vercel_path", [None])[0]
        if raw_vp:
            original_path = raw_vp if raw_vp.startswith("/") else f"/{raw_vp}"
            while original_path.startswith("//"):
                original_path = original_path[1:]
        request.scope["query_string"] = urlencode(parsed, doseq=True).encode("utf-8")

    if not original_path:
        forwarded_uri = (
            request.headers.get("x-forwarded-uri")
            or request.headers.get("x-original-uri")
            or request.headers.get("x-rewrite-url")
        )
        raw_path = request.scope.get("path", "")
        original_path = forwarded_uri or raw_path

    if "?" in original_path:
        original_path = original_path.split("?", 1)[0]

    for prefix in ("/api/index.py", "/api/index"):
        if original_path.startswith(prefix):
            remainder = original_path[len(prefix):]
            original_path = remainder if remainder.startswith("/") else ("/" + remainder) if remainder else "/"
            break

    if original_path in ("/api/index.py", "/api/index", ""):
        original_path = "/"

    request.scope["path"] = original_path
    return await call_next(request)


# Include API router for both /api/v1 and /v1 (in case a reverse proxy or rewrite strips /api)
app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/v1")


@app.get("/", include_in_schema=False)
@app.get("/api", include_in_schema=False)
@app.get("/api/index.py", include_in_schema=False)
async def root_status() -> dict[str, str]:
    return {
        "service": settings.app_name,
        "status": "healthy",
        "health_url": "/api/v1/health",
    }


CONSENT_HTML_PATH = Path(__file__).resolve().parent / "templates" / "consent.html"


@app.get("/oauth/consent", response_class=HTMLResponse, include_in_schema=False)
@app.get("/api/v1/auth/consent", response_class=HTMLResponse, include_in_schema=False)
async def oauth_consent_page(request: Request) -> HTMLResponse:
    if not CONSENT_HTML_PATH.exists():
        return HTMLResponse("<h3>Consent template not found</h3>", status_code=500)

    html = CONSENT_HTML_PATH.read_text(encoding="utf-8")
    supa_url = settings.supabase_url or ""
    supa_key = settings.supabase_publishable_key or ""
    html = html.replace("__SUPABASE_URL__", supa_url).replace("__SUPABASE_KEY__", supa_key)
    return HTMLResponse(content=html, status_code=200)


# Global exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({"field": field, "message": error["msg"]})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": errors,
        },
    )


@app.exception_handler(ValidationError)
async def pydantic_validation_handler(request: Request, exc: ValidationError) -> JSONResponse:
    errors = []
    for error in exc.errors():
        field = " -> ".join(str(loc) for loc in error["loc"])
        errors.append({"field": field, "message": error["msg"]})

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Validation error",
            "errors": errors,
        },
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")

    # Don't expose internal error details in production
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An unexpected error occurred. Please try again later.",
        },
    )
