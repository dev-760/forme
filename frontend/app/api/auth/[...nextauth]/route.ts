import NextAuth, { type NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";
import CredentialsProvider from "next-auth/providers/credentials";

type OIDCProfile = {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  picture?: string;
};

const issuer = process.env.OIDC_ISSUER_URL?.replace(/\/+$/, "");
const providers: NextAuthOptions["providers"] = [];

if (issuer && process.env.OIDC_CLIENT_ID) {
  const rawSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  const isPublicClient =
    !rawSecret ||
    rawSecret.toLowerCase() === "none" ||
    rawSecret.toLowerCase() === "disabled" ||
    rawSecret.toLowerCase() === "null";

  const oidc: OAuthConfig<OIDCProfile> = {
    id: "oidc",
    name: "Continue with SSO",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: isPublicClient ? undefined : rawSecret,
    client: {
      token_endpoint_auth_method: isPublicClient ? "none" : undefined,
      id_token_signed_response_alg: "ES256",
    },
    authorization: { params: { scope: "openid email profile" } },
    checks: ["pkce", "state"],
    idToken: true,
    profile: (profile) => ({
      id: profile.sub,
      name: profile.name || profile.preferred_username || profile.email?.split("@")[0] || "FORME member",
      email: profile.email,
      image: profile.picture,
    }),
  };
  providers.push(oidc);
}

if (process.env.DEV_MODE === "true" && process.env.NODE_ENV !== "production") {
  providers.push(
    CredentialsProvider({
      id: "dev-credentials",
      name: "Development sign in",
      credentials: {
        email: { label: "Email", type: "email" },
        name: { label: "Name", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email) return null;
        const email = String(credentials.email);
        return {
          id: email.toLowerCase(),
          email,
          name: String(credentials.name || email.split("@")[0]),
        };
      },
    })
  );
}

const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (!user && token.accessToken && !token.syncError) return token;

      // Extract account tokens
      if (account?.access_token) {
        token.supabaseAccessToken = account.access_token;
      }
      if (account?.id_token) {
        token.idToken = account.id_token;
      }

      const configuredBase = (
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "https://wardrowbe-api-chi.vercel.app"
      )
        .replace(/\/api\/v1\/?$/, "")
        .replace(/\/$/, "");

      const fallbackBase = "https://wardrowbe-api-chi.vercel.app";
      const candidateBases = [configuredBase];
      if (configuredBase !== fallbackBase) {
        candidateBases.push(fallbackBase);
      }

      const syncPayload = JSON.stringify({
        external_id: user?.id || token.sub,
        email: user?.email || token.email,
        display_name:
          user?.name ||
          token.name ||
          (user?.email || token.email ? String(user?.email || token.email).split("@")[0] : "Member"),
        avatar_url: user?.image || token.picture,
        id_token: account?.id_token || (token.idToken as string | undefined),
      });

      let syncSuccessful = false;
      let lastErrorMessage = "";

      for (const base of candidateBases) {
        try {
          const response = await fetch(`${base}/api/v1/auth/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: syncPayload,
          });

          const result = await response.json().catch(() => ({}));

          if (response.ok && result.access_token) {
            token.accessToken = result.access_token;
            token.backendUserId = result.id;
            token.syncError = undefined;
            syncSuccessful = true;
            break;
          } else {
            lastErrorMessage =
              typeof result.detail === "string"
                ? result.detail
                : `Account sync failed (${response.status})`;
          }
        } catch {
          lastErrorMessage = "Unable to connect to the wardrobe service.";
        }
      }

      if (!syncSuccessful) {
        token.syncError = lastErrorMessage || "Account sync failed";
        // Fall back to Supabase tokens so user session is valid
        token.accessToken = (account?.access_token || account?.id_token || token.supabaseAccessToken || token.idToken) as string;
      }

      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken,
        backendUserId: token.backendUserId,
        syncError: token.syncError,
      } as typeof session & {
        accessToken?: string;
        backendUserId?: string;
        syncError?: string;
      };
    },
  },
  pages: { signIn: "/login", error: "/login" },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
