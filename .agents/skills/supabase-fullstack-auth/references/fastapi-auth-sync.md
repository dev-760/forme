# FastAPI Backend Auth Sync & JWKS Verification

This document explains the architecture of the `/api/v1/auth/sync` bridge endpoint in FastAPI, which validates the Supabase OIDC `id_token` and provisions or synchronizes the user profile in PostgreSQL.

---

## 1. Responsibilities of `/api/v1/auth/sync`

1. **Verify Authenticity**: Validates the cryptographic signature of the `id_token` against Supabase's live public keys (`/.well-known/jwks.json`).
2. **Verify Claims**: Checks standard OIDC claims:
   - `iss`: Matches `https://<project-ref>.supabase.co/auth/v1`
   - `aud`: Matches `client_id` (your frontend OAuth Client ID)
   - `exp`: Token has not expired
   - `sub`: The immutable Supabase user UUID
3. **Database Upsert**:
   - Finds or creates the `User` record in your local database using `external_id` (the `sub` claim).
   - Updates display name, avatar, and email if changed.
4. **Issue Local Application Token**:
   - Signs an application-level JWT access token (e.g. HS256 with `SECRET_KEY`) containing the internal database `user_id`, permissions, and role.
   - Returns `{ access_token, token_type: "bearer", id: user.id }`.

---

## 2. Cryptographic Verification with PyJWT

```python
import jwt
from jwt import PyJWKClient

class OIDCVerifier:
    def __init__(self, jwks_url: str, issuer: str, audience: str):
        self.jwks_client = PyJWKClient(jwks_url)
        self.issuer = issuer
        self.audience = audience

    def verify_token(self, token: str) -> dict:
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        data = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=self.audience,
            issuer=self.issuer,
            options={"require": ["exp", "iss", "sub"]},
        )
        return data
```

---

## 3. Database Sync Transaction

```python
@router.post("/auth/sync")
async def sync_user(
    body: SyncUserRequest,
    db: DbSession,
    settings: Settings = Depends(get_settings),
):
    if not settings.oidc_configured:
        raise HTTPException(status_code=503, detail="No authentication method configured")

    if not body.id_token:
        raise HTTPException(status_code=401, detail="OIDC id_token is required for authentication")

    claims = verify_supabase_id_token(body.id_token, settings)
    external_id = claims["sub"]
    email = claims.get("email") or body.email

    # Find existing identity or user
    stmt = select(User).where(User.external_id == external_id)
    user = (await db.execute(stmt)).scalar_one_or_none()

    if not user:
        user = User(
            external_id=external_id,
            email=email,
            display_name=body.display_name or email.split("@")[0],
            avatar_url=body.avatar_url,
        )
        db.add(user)
        await db.flush()
    else:
        # Update mutable fields
        if body.display_name:
            user.display_name = body.display_name
        if body.avatar_url:
            user.avatar_url = body.avatar_url

    await db.commit()

    # Generate custom application JWT
    access_token = create_access_token(user_id=str(user.id), secret_key=settings.secret_key)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "id": str(user.id),
    }
```
