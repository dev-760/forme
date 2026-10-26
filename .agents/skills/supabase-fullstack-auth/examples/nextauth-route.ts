import NextAuth, { type NextAuthOptions } from "next-auth";
import type { OAuthConfig } from "next-auth/providers/oauth";

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
  const oidc: OAuthConfig<OIDCProfile> = {
    id: "oidc",
    name: "Continue with SSO",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    clientId: process.env.OIDC_CLIENT_ID,
    // Do NOT set clientSecret for public PKCE clients
    clientSecret: undefined,
    client: {
      token_endpoint_auth_method: "none",
      // Supabase signs ID tokens with ES256; NextAuth defaults to RS256 without this setting
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
  providers.push(oidc);
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      // Allow re-attempting synchronization on page reload if an error previously occurred
      if (!user && token.accessToken && !token.syncError) return token;

      if (account?.access_token) token.supabaseAccessToken = account.access_token;
      if (account?.id_token) token.idToken = account.id_token;

      const base = (
        process.env.BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        "http://localhost:8000"
      )
        .replace(/\/api\/v1\/?$/, "")
        .replace(/\/$/, "");

      try {
        const response = await fetch(`${base}/api/v1/auth/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            external_id: user?.id || token.sub,
            email: user?.email || token.email,
            display_name:
              user?.name ||
              token.name ||
              (user?.email || token.email ? String(user?.email || token.email).split("@")[0] : "Member"),
            avatar_url: user?.image || token.picture,
            id_token: account?.id_token || (token.idToken as string | undefined),
          }),
        });

        const result = await response.json().catch(() => ({}));

        if (response.ok && result.access_token) {
          token.accessToken = result.access_token;
          token.backendUserId = result.id;
          token.syncError = undefined; // Cleared on successful sync!
        } else {
          token.syncError =
            typeof result.detail === "string"
              ? result.detail
              : `Account sync failed (${response.status})`;
          token.accessToken = (account?.access_token || account?.id_token || token.supabaseAccessToken || token.idToken) as string;
        }
      } catch {
        token.syncError = "Unable to connect to the wardrobe service.";
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
