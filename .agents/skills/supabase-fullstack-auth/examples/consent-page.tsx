"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://<ref>.supabase.co";
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "<anon-key>";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default function ConsentPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [clientName, setClientName] = useState<string>("Application");
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);

  useEffect(() => {
    async function initConsent() {
      try {
        const params = new URLSearchParams(window.location.search);
        const authId = params.get("authorization_id");
        if (!authId) {
          setError("Missing authorization_id parameter.");
          setLoading(false);
          return;
        }
        setAuthorizationId(authId);

        // 1. Check user session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Redirect to sign in if no active session
          window.location.href = `/login?return_to=${encodeURIComponent(window.location.href)}`;
          return;
        }

        setUserEmail(session.user.email ?? "Authenticated user");

        // 2. Bind session to authorization ID
        const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_KEY,
          },
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.msg || errData.error_description || `Failed to bind authorization (${res.status})`);
        }

        const data = await res.json();
        // If already approved, auto-redirect immediately
        if (data.status === "approved" && data.redirect_to) {
          window.location.href = data.redirect_to;
          return;
        }

        if (data.client?.client_name) {
          setClientName(data.client.client_name);
        }

        setLoading(false);
      } catch (err: any) {
        setError(err.message || "Unable to process authorization request.");
        setLoading(false);
      }
    }

    void initConsent();
  }, []);

  async function handleApprove() {
    if (!authorizationId || submitting) return;
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session expired. Please sign in again.");

      const res = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorizations/${authorizationId}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "approve" }),
      });

      const data = await res.json();
      if (res.ok && data.redirect_to) {
        window.location.href = data.redirect_to;
      } else {
        throw new Error(data.msg || data.error_description || "Approval was not completed.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to approve authorization.");
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0c0d0e", color: "#f3f4f6", padding: "20px" }}>
      <div style={{ background: "#17181a", border: "1px solid #2b2c30", borderRadius: "16px", padding: "32px", width: "100%", maxWidth: "420px" }}>
        {loading ? (
          <p style={{ textAlign: "center", color: "#9ca3af" }}>Verifying authorization request...</p>
        ) : error ? (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid #ef4444", color: "#f87171", padding: "12px", borderRadius: "8px", fontSize: "14px" }}>
            {error}
          </div>
        ) : (
          <div>
            <h1 style={{ fontSize: "20px", fontWeight: "600", marginBottom: "8px" }}>Authorize {clientName}</h1>
            <p style={{ fontSize: "14px", color: "#9ca3af", marginBottom: "20px" }}>
              Connecting as <strong style={{ color: "#fff" }}>{userEmail}</strong>
            </p>
            <button
              onClick={handleApprove}
              disabled={submitting}
              style={{ width: "100%", padding: "12px", background: "#fff", color: "#000", border: "none", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
            >
              {submitting ? "Authorizing..." : "Authorize Application"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
