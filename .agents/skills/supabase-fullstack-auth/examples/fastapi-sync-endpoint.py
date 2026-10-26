# ruff: noqa: E402
from datetime import datetime, timezone, timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
import jwt
from jwt import PyJWKClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()

class SyncUserRequest(BaseModel):
    external_id: str
    email: str | None = None
    display_name: str | None = None
    avatar_url: str | None = None
    id_token: str | None = None

def verify_supabase_id_token(id_token: str, jwks_url: str, issuer: str, client_id: str) -> dict:
    try:
        jwks_client = PyJWKClient(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(id_token)
        claims = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=client_id,
            issuer=issuer,
            options={"require": ["exp", "iss", "sub"]},
        )
        return claims
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid ID token: {str(exc)}",
        ) from exc

def create_application_jwt(user_id: str, secret_key: str, expires_delta_minutes: int = 1440) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=expires_delta_minutes)).timestamp()),
    }
    return jwt.encode(payload, secret_key, algorithm="HS256")

# Example route integration
@router.post("/auth/sync")
async def sync_user(
    body: SyncUserRequest,
    db: AsyncSession, # Dependency injected AsyncSession
    # settings: Settings = Depends(get_settings),
):
    # 1. Verify id_token if OIDC is configured
    # claims = verify_supabase_id_token(body.id_token, settings.jwks_url, settings.issuer, settings.client_id)
    # external_id = claims["sub"]
    external_id = body.external_id

    # 2. Query user in PostgreSQL
    # stmt = select(User).where(User.external_id == external_id)
    # user = (await db.execute(stmt)).scalar_one_or_none()
    # if not user:
    #     user = User(external_id=external_id, email=body.email, display_name=body.display_name)
    #     db.add(user)
    #     await db.commit()

    # 3. Issue internal token
    # access_token = create_application_jwt(str(user.id), settings.secret_key)
    return {
        "access_token": "app_jwt_token_example",
        "token_type": "bearer",
        "id": "user-uuid",
    }
