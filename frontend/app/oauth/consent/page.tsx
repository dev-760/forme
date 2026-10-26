"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { FormeBrand } from "../../components/brand";
import { Sparkles, LoaderCircle, Check, X, ShieldCheck } from "lucide-react";

const SUPABASE_URL = "https://ewcmihwbszizkshwqmnt.supabase.co";
const SUPABASE_KEY = "sb_publishable_yjahZxFK21GVdgDZ84IG0g_KZ-RR3k1";

export default function ConsentPage() {
  const [supabaseReady, setSupabaseReady] = useState(false);
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [clientName, setClientName] = useState("FORME Atelier");
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

  const initClient = async () => {
    if (typeof window === "undefined" || !(window as any).supabase) return;
    const client = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    (window as any).__supabaseClient = client;

    const params = new URLSearchParams(window.location.search);
    const authId = params.get("authorization_id");

    try {
      const { data: { session } } = await client.auth.getSession();
      if (session && session.user) {
        setUser(session.user);
        if (authId && client.auth.oauth?.getAuthorizationDetails) {
          try {
            const { data } = await client.auth.oauth.getAuthorizationDetails(authId);
            if (data?.client?.name) setClientName(data.client.name);
          } catch {}
        }
      }
    } catch (e: any) {
      console.warn("Session check failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const client = (window as any).__supabaseClient;
    if (!client) return;

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

      if (res.data?.user) {
        setUser(res.data.user);
      } else {
        setError("Please check your email to confirm registration before logging in.");
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async () => {
    if (!authorizationId) return;
    setSubmitting(true);
    setError("");
    const client = (window as any).__supabaseClient;
    try {
      const { data, error } = await client.auth.oauth.approveAuthorization(authorizationId);
      if (error) {
        setError(error.message || "Authorization failed");
        setSubmitting(false);
        return;
      }
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        setError("Authorization approved, but no redirect URL was returned.");
        setSubmitting(false);
      }
    } catch (err: any) {
      setError(err.message || "Approval failed");
      setSubmitting(false);
    }
  };

  const deny = async () => {
    if (!authorizationId) return;
    const client = (window as any).__supabaseClient;
    try {
      const { data } = await client.auth.oauth.denyAuthorization(authorizationId);
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
      } else {
        window.history.back();
      }
    } catch {
      window.history.back();
    }
  };

  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="afterInteractive"
        onLoad={() => {
          setSupabaseReady(true);
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
          ) : user ? (
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
                <span className="muted">Account</span>
                <strong style={{ color: "var(--text)" }}>{user.email}</strong>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <button className="button primary full" onClick={approve} disabled={submitting}>
                  {submitting ? (
                    <>
                      <LoaderCircle size={15} className="spin" /> Authorizing...
                    </>
                  ) : (
                    <>
                      <Check size={16} /> Authorize access
                    </>
                  )}
                </button>
                <button className="button secondary" onClick={deny} disabled={submitting}>
                  <X size={15} /> Cancel
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
                Sign in with your Supabase account to authorize access.
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
                      <LoaderCircle size={15} className="spin" /> Processing...
                    </>
                  ) : isSignUp ? (
                    "Create account"
                  ) : (
                    "Sign in & continue"
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
