# Supabase OAuth 2.1 & OIDC PKCE Configuration

Supabase Auth provides built-in OAuth 2.1 authorization server capabilities, supporting OpenID Connect (OIDC) discovery, PKCE (Proof Key for Code Exchange), and custom consent pages.

---

## 1. Supabase Auth Configuration

1. **Enable OpenID Connect / OAuth 2.1**:
   - In Supabase Dashboard: Go to **Project Settings** &rarr; **Authentication** &rarr; **OAuth Server** (or **Custom Providers**).
   - Verify discovery URL: `https://<project-ref>.supabase.co/auth/v1/.well-known/openid-configuration`
   - Verify JWKS URL: `https://<project-ref>.supabase.co/auth/v1/.well-known/jwks.json`

2. **Redirect URLs**:
   - Add the NextAuth callback URL to **URL Configuration** &rarr; **Redirect URLs**:
     - `http://localhost:3000/api/auth/callback/oidc`
     - `https://your-domain.com/api/auth/callback/oidc`

3. **Consent Screen URL**:
   - If using custom consent, set the Authorization Consent URL to:
     `https://your-domain.com/oauth/consent`

---

## 2. Token Signing Algorithm (`ES256`)

Supabase signs OpenID Connect ID tokens with **`ES256`** (ECDSA using the P-256 curve and SHA-256).

### Why this breaks standard NextAuth
`openid-client` (the engine underlying NextAuth OAuth providers) defaults to `RS256` if `id_token_signed_response_alg` is omitted from client configuration.

When NextAuth receives an `ES256` token without this flag, it fails with:
```
RPError: unexpected JWT alg received, expected RS256, got: ES256
```
This manifests in the frontend as an unhandled redirect back to `/login?error=OAuthCallback`.

### The Solution
Explicitly define `id_token_signed_response_alg: "ES256"` in NextAuth client configuration:
```typescript
client: {
  token_endpoint_auth_method: "none",
  id_token_signed_response_alg: "ES256",
}
```

---

## 3. Custom Consent Screen Session Binding

When Supabase redirects the user to your custom `/oauth/consent?authorization_id=<id>` page, the authorization ID is unbound until the user's active session is attached.

### The Problem
Calling `approveAuthorization(id)` directly without binding results in:
```
Auth session missing!
```

### The Solution: 2-Step Binding Pattern
1. Retrieve the user's active Supabase session (`access_token`).
2. Make a `GET` request to `/auth/v1/oauth/authorizations/{id}` with `Authorization: Bearer <access_token>`.
3. Check the response:
   - If `status === "approved"`, redirect immediately to `response.redirect_to`.
   - If pending, render the application details and allow user approval via `POST /auth/v1/oauth/authorizations/{id}` with `{ action: "approve" }`.

See [`examples/consent-page.tsx`](../examples/consent-page.tsx) for the complete production implementation.
