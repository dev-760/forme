# NextAuth Configuration & Resilient JWT Sync

This document details how to configure NextAuth v4 in the Next.js App Router (`app/api/auth/[...nextauth]/route.ts`) for Supabase OIDC and custom backend user synchronization.

---

## 1. Provider Definition

```typescript
const oidc: OAuthConfig<OIDCProfile> = {
  id: "oidc",
  name: "Continue with SSO",
  type: "oauth",
  wellKnown: `${issuer}/.well-known/openid-configuration`,
  clientId: process.env.OIDC_CLIENT_ID!,
  // Do NOT provide clientSecret for public PKCE clients
  clientSecret: undefined,
  client: {
    token_endpoint_auth_method: "none",
    id_token_signed_response_alg: "ES256",
  },
  authorization: { params: { scope: "openid email profile" } },
  checks: ["pkce", "state"],
  idToken: true,
  profile: (profile) => ({
    id: profile.sub,
    name: profile.name || profile.preferred_username || profile.email?.split("@")[0] || "Member",
    email: profile.email,
    image: profile.picture,
  }),
};
```

---

## 2. The Resilient JWT Callback Pattern

### The Trap: Infinite Failure Lockout
In typical NextAuth setups, once `token.accessToken` is set, `jwt` returns early:
```typescript
if (!user && token.accessToken) return token;
```
If the backend sync endpoint returns `500` or is momentarily unreachable during sign-in, and the code sets `token.accessToken = account.access_token` as a fallback, NextAuth permanently caches `token.syncError`. Reloading the page NEVER retries the backend sync, leaving the user locked out unless they clear cookies or sign out.

### The Fix: Retry on Sync Error
Check `!token.syncError` in the early-exit condition:
```typescript
// Only skip execution if session is already active AND has no outstanding sync error
if (!user && token.accessToken && !token.syncError) return token;
```
If `token.syncError` is present, the callback re-executes the backend sync request on the next page visit or reload. Once the backend finishes deploying or recovers, the user is automatically transitioned to an active session!

---

## 3. Session Synchronization Flow

```typescript
callbacks: {
  async jwt({ token, user, account }) {
    if (!user && token.accessToken && !token.syncError) return token;

    if (account?.access_token) token.supabaseAccessToken = account.access_token;
    if (account?.id_token) token.idToken = account.id_token;

    const base = (process.env.BACKEND_URL || "https://api.yourdomain.com")
      .replace(/\/api\/v1\/?$/, "")
      .replace(/\/$/, "");

    try {
      const response = await fetch(`${base}/api/v1/auth/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          external_id: user?.id || token.sub,
          email: user?.email || token.email,
          display_name: user?.name || token.name || "Member",
          avatar_url: user?.image || token.picture,
          id_token: account?.id_token || token.idToken,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.ok && result.access_token) {
        token.accessToken = result.access_token;     // Custom backend JWT
        token.backendUserId = result.id;
        token.syncError = undefined;                 // Cleared on success!
      } else {
        token.syncError = typeof result.detail === "string" ? result.detail : `Account sync failed (${response.status})`;
        token.accessToken = (account?.access_token || token.supabaseAccessToken) as string;
      }
    } catch {
      token.syncError = "Unable to connect to the wardrobe service.";
      token.accessToken = (account?.access_token || token.supabaseAccessToken) as string;
    }

    return token;
  },
  async session({ session, token }) {
    return {
      ...session,
      accessToken: token.accessToken,
      backendUserId: token.backendUserId,
      syncError: token.syncError,
    };
  },
}
```
