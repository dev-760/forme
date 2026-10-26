# FORME Atelier — Supabase Auth Email Templates

These responsive, luxury-styled email templates are designed for **FORME** and ready to paste directly into your **Supabase Dashboard** (**Authentication** &rarr; **Email Templates**).

---

## 1. Confirm Sign Up (`confirm-signup.html`)
* **Supabase Template Type:** `Confirm signup`
* **Subject line suggestion:** `Welcome to FORME — Confirm your email address`
* **Supabase Variables Supported:**
  * `{{ .ConfirmationURL }}` — Direct one-click confirmation link
  * `{{ .Token }}` — 6-digit verification code
  * `{{ .Email }}` — Recipient email address
  * `{{ .SiteURL }}` — Base website URL (`https://frome.hassankarasu.dev`)

---

## 2. Reset Password (`reset-password.html`)
* **Supabase Template Type:** `Reset password`
* **Subject line suggestion:** `FORME — Reset your password`
* **Supabase Variables Supported:**
  * `{{ .ConfirmationURL }}` — Password reset link
  * `{{ .Token }}` — 6-digit reset code
  * `{{ .Email }}` — Recipient email address
  * `{{ .SiteURL }}` — Base website URL

---

## 3. Password Changed (`password-changed.html`)
* **Supabase Template Type:** Custom notification or webhook triggered
* **Subject line suggestion:** `Security Notice: Your FORME password was changed`
* **Variables Supported:**
  * `{{ .Email }}` — Account email address
  * `{{ .SiteURL }}` — Base website URL (`https://frome.hassankarasu.dev`)

---

## Aesthetic & Design Details
* **Typography:** `Cormorant Garamond` (editorial italic serif) + `Manrope` (structural tracked sans-serif) + Monospace token block.
* **Palette:**
  * Background: `#0A0B0A` (obsidian black)
  * Card surface: `#121412` with `#232722` subtle borders
  * Primary action: `#E8E3DA` (ivory linen) with dark typography
  * Accent & eyebrow: `#8A9A7B` (botanical sage)
* **Bulletproof rendering:** Compatible with Gmail, Apple Mail, iOS Mail, and Outlook.
