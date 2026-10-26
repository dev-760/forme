# Supabase Auth Email Templates Architecture

Supabase provides automated email delivery for signups, password resets, magic links, and invites.

---

## 1. Supabase Variable Reference

| Variable | Supported In | Description |
| :--- | :--- | :--- |
| `{{ .ConfirmationURL }}` | Confirm signup, Reset password, Magic link | One-click direct authentication / confirmation link |
| `{{ .Token }}` | Confirm signup, Reset password | 6-digit numeric OTP code for manual entry |
| `{{ .Email }}` | All templates | Recipient's email address |
| `{{ .SiteURL }}` | All templates | Application base URL configured in Supabase |

---

## 2. High-End Email Styling Guidelines

1. **Table-Based Architecture**:
   - Use standard `<table>`, `<tr>`, `<td>` wrappers with `role="presentation"`.
   - Set `max-width: 540px` centered for desktop, collapsing to 100% on mobile.
2. **Typography Resilience**:
   - Web font `@import` for typography (e.g. `Cormorant Garamond` + `Manrope`).
   - System fallback stacks: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`.
3. **Dual Link & Token Support**:
   - Always include the primary button (`<a href="{{ .ConfirmationURL }}">`) for desktop users.
   - Always include a dedicated token card (`<div class="token">{{ .Token }}</div>`) for mobile or copy-paste users.
   - Include the raw link in monospace at the bottom as a fallback.

Reference templates can be copied directly from the repository's [`email-templates/`](../../../email-templates/) directory.
