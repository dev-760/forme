# FORME

FORME is a web client for the wardrobe API in [`backend/`](backend/). The backend remains the source of truth for users, wardrobe items, AI tagging, recommendations, preferences, and history.

## Run locally

1. Start the existing FastAPI backend using its documented environment and database setup. Its default API prefix is `/api/v1` (typically `http://localhost:8000/api/v1`).
2. In `frontend/`, copy `.env.example` to `.env.local` and configure the identity provider and `NEXTAUTH_SECRET`. For local-only sign-in, enable `DEV_MODE=true` and use the backend's `DEBUG=true` mode.
3. Run `npm install`, then `npm run dev` from `frontend/` and open `http://localhost:3000`.

The development login is intentionally disabled in production. Do not expose backend private keys through `NEXT_PUBLIC_*` variables. OIDC secrets and `NEXTAUTH_SECRET` belong only in the frontend host's server-side environment settings. The frontend exchanges identity with the existing `/auth/sync` contract and uses its returned bearer token for authenticated API calls.

## Deploy

Deploy `frontend/` as its own Next.js project on Vercel (set the project root to `frontend`). Set `NEXT_PUBLIC_API_BASE_URL` to the public backend origin plus `/api/v1`, and set `BACKEND_URL` to the backend origin. Configure `NEXTAUTH_URL`, a strong random `NEXTAUTH_SECRET`, and the OIDC issuer/client credentials in Vercel's server-side environment settings for production and preview as needed. Register each frontend callback URL with the identity provider (`/api/auth/callback/oidc`).

The FastAPI service, database, storage, and background worker stay on their existing hosting. The backend's `CORS_ORIGINS` must include each frontend origin. Its existing Vercel configuration is for the API deployment and should not be reused as the Next.js frontend deployment configuration.

## Backend contract used

The client calls the existing API: `/auth/sync`, `/users/me`, `/users/me/preferences`, `/items`, `/outfits`, `/weather/current`, and `/analytics`. Uploads use multipart `POST /items`; generated recommendations use `POST /outfits/suggest`; outfit acceptance uses the existing `POST /outfits/{id}/accept`. No database or backend contract changes are included.
