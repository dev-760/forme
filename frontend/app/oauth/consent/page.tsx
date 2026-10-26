"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { FormeBrand } from "../../components/brand";
import { LoaderCircle, Check, X, ShieldCheck, ArrowRight, UserCheck } from "lucide-react";

const SUPABASE_URL = "https://ewcmihwbszizkshwqmnt.supabase.co";
const SUPABASE_KEY = "sb_publishable_yjahZxFK21GVdgDZ84IG0g_KZ-RR3k1";

export default function ConsentPage() {
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [clientName, setClientName] = useState("FORME");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authId = params.get("authorization_id");
    setAuthorizationId(authId);
    if (!authId) {
      setError("Missing authorization_id parameter. Please start login from the sign-in page.");
      setLoading(false);
    }
  }, []);

  // Process authorization: bind authorization request to user and finalize consent
  const processAuthorization = async (token: string, authId: string, directApprove = false) => {
    setSubmitting(true);
    setError("");

    try {
      // Step 1: Bind authorization to authenticated user and check existing consent state
      const detailsResp = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId}`, {
        method: "GET",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
        },
      });

      const detailsData = await detailsResp.json().catch(() => ({}));

      // If user has already consented or was auto-approved, redirect URL is provided immediately
      if (detailsData.redirect_url) {
        window.location.href = detailsData.redirect_url;
        return;
      }

      if (!detailsResp.ok) {
        throw new Error(
          detailsData.msg || detailsData.error_description || detailsData.error || "Invalid authorization request"
        );
      }

      if (detailsData.client?.name) {
        setClientName(detailsData.client.name);
      }

      // If called from initClient and user hasn't clicked approve yet, let them view consent screen
      if (!directApprove) {
        setLoading(false);
        setSubmitting(false);
        return;
      }

      // Step 2: Explicitly approve consent
      const consentResp = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId}/consent`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve" }),
      });

      const consentData = await consentResp.json().catch(() => ({}));

      if (consentData.redirect_url) {
        window.location.href = consentData.redirect_url;
        return;
      }

      if (!consentResp.ok) {
        // If already approved between calls, check GET once more
        if (consentData.error_code === "validation_failed") {
          const recheck = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId}`, {
            headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` },
          });
          const recheckData = await recheck.json().catch(() => ({}));
          if (recheckData.redirect_url) {
            window.location.href = recheckData.redirect_url;
            return;
          }
        }
        throw new Error(
          consentData.msg || consentData.error_description || consentData.error || `Consent failed (${consentResp.status})`
        );
      }

      throw new Error("Authorization approved, but no redirect URL was returned.");
    } catch (err: any) {
      setError(err.message || "Failed to authorize session.");
      setSubmitting(false);
      setLoading(false);
    }
  };

  const executeDeny = async (token?: string | null) => {
    const authId = authorizationId;
    if (!authId) return;

    if (token) {
      try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId}/consent`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "deny" }),
        });
        const data = await resp.json().catch(() => ({}));
        if (data.redirect_url) {
          window.location.href = data.redirect_url;
          return;
        }
      } catch {}
    }
    window.location.href = "/login";
  };

  const initClient = async () => {
    if (typeof window === "undefined" || !(window as any).supabase) return;
    const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    (window as any).__supabaseClient = client;

    const params = new URLSearchParams(window.location.search);
    const authId = params.get("authorization_id");

    try {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (session && session.user && session.access_token) {
        setUser(session.user);
        setAccessToken(session.access_token);

        if (authId) {
          // Bind session and check auto-redirect
          await processAuthorization(session.access_token, authId, false);
          return;
        }
      }
    } catch (e: any) {
      console.warn("Session check error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const client = (window as any).__supabaseClient;
    if (!client) {
      setError("Authorization service is initializing. Please try again.");
      setSubmitting(false);
      return;
    }

    try {
      let res;
      if (isSignUp) {
        res = await client.auth.signUp({ email, password });
      } else {
        res = await client.auth.signInWithPassword({ email, password });
      }

      if (res.error) {
        setError(res.error.message);
        setSubmitting(false);
        return;
      }

      const session = res.data?.session;
      const loggedUser = res.data?.user;

      if (session?.access_token && authorizationId) {
        setUser(loggedUser);
        setAccessToken(session.access_token);
        // Automatically bind authorization and finalize consent
        await processAuthorization(session.access_token, authorizationId, true);
      } else if (loggedUser && !session) {
        setError("Please check your email to confirm registration before logging in.");
        setSubmitting(false);
      } else {
        setError("Sign in did not return an active session. Please check your credentials.");
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
      setSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    const client = (window as any).__supabaseClient;
    if (client) {
      await client.auth.signOut();
    }
    setUser(null);
    setAccessToken(null);
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="afterInteractive"
        onLoad={() => {
          initClient();
        }}
      />
      <main className="login-screen">
        <div className="login-ambient" aria-hidden="true" />
        <div className="login-box" style={{ maxWidth: "440px" }}>
          <FormeBrand large subtitle="WARDROBE ATELIER" />

          {error && <div className="login-error" style={{ marginTop: "18px" }}>{error}</div>}

          {loading ? (
            <div className="login-loading" style={{ margin: "32px 0" }}>
              <LoaderCircle size={18} className="spin" /> Verifying authorization request...
            </div>
          ) : user && accessToken ? (
            <div style={{ marginTop: "24px", display: "grid", gap: "16px" }}>
              <div>
                <p className="eyebrow">AUTHORIZATION REQUEST</p>
                <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: "22px", margin: "8px 0" }}>
                  Connect your account
                </h2>
                <p className="muted" style={{ fontSize: "12.5px" }}>
                  <strong>{clientName}</strong> is requesting access to your personal wardrobe archive and preferences.
                </p>
              </div>

              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid var(--line)",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span className="muted" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <UserCheck size={14} /> Signed in
                </span>
                <strong style={{ color: "var(--text)" }}>{user.email}</strong>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button
                  className="button primary full"
                  onClick={() => authorizationId && processAuthorization(accessToken, authorizationId, true)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Authorizing...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Authorize access <ArrowRight size={15} />
                    </>
                  )}
                </button>
                <button
                  className="button secondary"
                  onClick={() => executeDeny(accessToken)}
                  disabled={submitting}
                >
                  <X size={15} /> Cancel
                </button>
              </div>

              <div style={{ textAlign: "center", marginTop: "4px" }}>
                <button className="text-button" type="button" onClick={handleSignOut}>
                  Use a different account
                </button>
              </div>

              <div className="login-foot">
                <ShieldCheck size={14} />
                <span>Encrypted OAuth 2.0 PKCE Authorization</span>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: "24px" }}>
              <p className="eyebrow">{isSignUp ? "CREATE ATELIER ACCOUNT" : "SIGN IN TO CONTINUE"}</p>
              <h2 style={{ fontFamily: "Manrope, sans-serif", fontSize: "22px", margin: "8px 0" }}>
                {isSignUp ? "Create your account" : "Enter your credentials"}
              </h2>
              <p className="muted" style={{ fontSize: "12.5px", marginBottom: "18px" }}>
                Sign in with your Supabase account to authorize access to your atelier.
              </p>

              <form className="dev-login" onSubmit={handleAuthSubmit} style={{ marginTop: "0" }}>
                <label>
                  Email address
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </label>
                <button className="button primary full" type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Authorizing & connecting...
                    </>
                  ) : isSignUp ? (
                    "Create account"
                  ) : (
                    <>
                      Sign in & Authorize <ArrowRight size={15} />
                    </>
                  )}
                </button>
              </form>

              <div style={{ textAlign: "center", marginTop: "14px" }}>
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError("");
                  }}
                >
                  {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
