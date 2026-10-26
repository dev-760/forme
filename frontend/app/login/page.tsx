"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProviders, signIn, useSession } from "next-auth/react";
import { Sparkles, LoaderCircle, ArrowRight, ShieldCheck, Layers3, CloudSun, AlertCircle } from "lucide-react";
import { FormeBrand } from "../components/brand";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [providers, setProviders] = useState<Record<string, { name: string }> | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    getProviders().then((p) => setProviders(p as any));
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const err = params.get("error");
      if (err) {
        if (err === "OAuthCallback") {
          setAuthError("The authorization code exchange could not be completed. Please try again.");
        } else if (err === "OAuthSignin") {
          setAuthError("Could not start the authorization request. Please try again.");
        } else {
          setAuthError(`Sign-in was interrupted (${err}). Please try again.`);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session) {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  const handleOidcSignIn = () => {
    setSubmitting(true);
    setAuthError(null);
    void signIn("oidc", { callbackUrl: "/dashboard" });
  };

  return (
    <main className="login-screen">
      <div className="login-ambient" aria-hidden="true" />
      <div className="login-shell">
        <section className="login-editorial">
          <a className="brand login-brand" href="/">
            <FormeBrand large subtitle="WARDROBE ATELIER" />
          </a>

          <div className="login-hero-copy">
            <p className="eyebrow">A WARDROBE, IN GOOD ORDER</p>
            <h1>
              Dress like
              <br />
              <em>yourself.</em>
            </h1>
            <p className="muted login-lead">
              A quieter way to catalog what you own, discover thoughtful combinations, and get dressed with intention every morning.
            </p>
          </div>

          <div className="login-pillars">
            <div className="login-pillar">
              <span className="pillar-icon">
                <Layers3 size={16} />
              </span>
              <div>
                <strong>Visual Archive</strong>
                <span>Every piece cataloged with AI-assisted color, fabric, and season notes.</span>
              </div>
            </div>
            <div className="login-pillar">
              <span className="pillar-icon">
                <CloudSun size={16} />
              </span>
              <div>
                <strong>Weather & Occasion Styling</strong>
                <span>Considered daily outfits tailored to local conditions and your calendar.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-card">
          <div className="login-card-header">
            <p className="eyebrow">PRIVATE ACCESS</p>
            <h2>Enter your atelier</h2>
            <p className="muted">Sign in to sync your personal wardrobe and styling preferences.</p>
          </div>

          {authError && (
            <div
              className="login-error"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "16px",
                fontSize: "12.5px",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{authError}</span>
            </div>
          )}

          {status === "loading" ? (
            <div className="login-loading" style={{ margin: "24px 0" }}>
              <LoaderCircle size={16} className="spin" /> Verifying session...
            </div>
          ) : providers?.oidc ? (
            <button
              className="button primary full login-cta"
              disabled={submitting}
              onClick={handleOidcSignIn}
            >
              {submitting ? (
                <>
                  <LoaderCircle size={16} className="spin" /> Connecting to your atelier...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Continue with your account
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          ) : null}

          {providers?.["dev-credentials"] && (
            <form
              className="dev-login"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitting(true);
                void signIn("dev-credentials", { email, name, callbackUrl: "/dashboard" });
              }}
            >
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
                Display name
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
              <button className="button primary full" type="submit" disabled={submitting}>
                Enter development wardrobe <ArrowRight size={15} />
              </button>
            </form>
          )}

          {!providers && (
            <div className="login-loading">
              <LoaderCircle size={16} className="spin" /> Preparing sign-in options...
            </div>
          )}

          {providers && Object.keys(providers).length === 0 && (
            <p className="login-error">
              Sign-in isn’t configured. Set OIDC provider details or enable development sign-in for local use.
            </p>
          )}

          <div className="login-foot">
            <ShieldCheck size={14} />
            <span>Encrypted session · Your wardrobe is private to your account.</span>
          </div>
        </section>
      </div>
    </main>
  );
}
