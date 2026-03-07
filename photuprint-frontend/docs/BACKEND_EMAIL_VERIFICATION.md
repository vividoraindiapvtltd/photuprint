# Backend Email Verification – API Spec & Reference

This document describes the backend behaviour required for the **email verification flow** and provides a reference implementation using **Resend** (free tier: 100 emails/day, 3,000/month).

---

## Requirements Summary

| Requirement | Implementation |
|------------|----------------|
| Do NOT activate user on Create Account | Create user with `emailVerified: false`, status `pending`. Return `{ msg, email }` only (no `user`/`token`). |
| Generate unique verification token | Use crypto.randomBytes(32).toString('hex') (or similar). Store **hashed** token only. |
| Send verification email | Use Resend (or another provider). Professional HTML template with verification link. |
| Verification link | `https://your-site.com/verify-email?token=<token>`. Token in URL is standard; do not put password or other sensitive data in URL. |
| Validate token on link click | Compare hash of incoming token with stored hash; check expiry. |
| If valid & not expired | Set `emailVerified: true`, activate account, complete registration. Return `{ user, token }` so frontend can log in. |
| If invalid/expired | Return 400 with `msg: "Link invalid or expired"`. Frontend shows error + resend option. |
| Token expiry | e.g. 24 hours. Store `verificationTokenExpiresAt` (or equivalent). |
| Prevent login before verification | In login handler, if `!user.emailVerified` return 403 with `msg: "Please verify your email before signing in."` |
| Resend verification API | `POST /auth/resend-verification` with `{ email }`. Generate new token, update expiry, send email again. |
| Security | Store only **hashed** token (e.g. bcrypt or SHA-256). Never log or expose raw token. |

---

## API Contract

### 1. POST /auth/register

**Request body:** `{ name, email, password [, mobile ] }`

**Behaviour:**

- Validate input (email format, password length, etc.).
- If email already exists and is verified → return 400.
- If email exists but not verified → optionally overwrite/resend (or return “already registered, check email”).
- Create user with:
  - `emailVerified: false`
  - `status: 'pending'` (or equivalent)
  - Password stored hashed (bcrypt).
- Generate verification token: `token = crypto.randomBytes(32).toString('hex')`.
- Store in DB: `verificationTokenHash = hash(token)` (e.g. SHA-256 or bcrypt), `verificationTokenExpiresAt = now + 24h`.
- Send verification email (see template below) with link:  
  `https://<FRONTEND_ORIGIN>/verify-email?token=<token>`
- **Response:** `200` with `{ msg: "Verification email sent to your email address.", email: "<email>" }`.  
  Do **not** return `user` or `token`.

---

### 2. POST /auth/verify-email

**Request body:** `{ token: string }`

**Behaviour:**

- Find pending user by matching stored hash: `hash(incomingToken) === verificationTokenHash`.
- If not found or token expired (`verificationTokenExpiresAt < now`) → `400` with  
  `{ msg: "This link is invalid or has expired." }`.
- If valid:
  - Set `emailVerified: true`, `status: 'active'` (or equivalent).
  - Clear `verificationTokenHash` and `verificationTokenExpiresAt`.
  - Optionally auto-login: generate JWT and return `{ user, token }` so frontend can log in immediately.
- **Response:** `200` with `{ user, token }` (or `{ msg: "Email verified. You can sign in." }` if you prefer no auto-login).

---

### 3. POST /auth/resend-verification

**Request body:** `{ email: string }`

**Behaviour:**

- Find user by email with `emailVerified: false`.
- If not found → `400` with `{ msg: "No pending registration found for this email." }`.
- Generate new token, store hash + new expiry (e.g. 24h), send same verification email again.
- **Response:** `200` with `{ msg: "Verification email sent." }`.

---

### 4. POST /auth/login

**Request body:** `{ email, password }`

**Behaviour:**

- Validate credentials.
- If valid but `user.emailVerified === false` → **403** with  
  `{ msg: "Please verify your email before signing in." }`.  
  Do **not** return `user` or `token`.
- If valid and verified → return `200` with `{ user, token }`.

---

## Security Best Practices

- **Hashed token storage:** Store only `hash(token)` (e.g. `crypto.createHash('sha256').update(token).digest('hex')` or bcrypt). Never store raw token.
- **No sensitive data in URL:** Only the one-time verification token is in the link. No password, no email in path/query (email can be inferred server-side from token).
- **Time-bound token:** Enforce expiry (e.g. 24h) and reject expired tokens in `verify-email` and when checking resend.
- **Rate limit:** Throttle `resend-verification` and `register` by IP/email to prevent abuse.
- **HTTPS:** Verification links must use HTTPS in production.

---

## Resend (Free Tier) – Sending the Email

1. Sign up at [resend.com](https://resend.com) and create an API key.
2. Add to env: `RESEND_API_KEY=re_xxxx`, `FRONTEND_ORIGIN=https://your-app.com` (for link in email).
3. Install: `npm install resend`.

**Example send (Node.js):**

```js
const { Resend } = require('resend')
const resend = new Resend(process.env.RESEND_API_KEY)

const verificationLink = `${process.env.FRONTEND_ORIGIN}/verify-email?token=${token}`

await resend.emails.send({
  from: 'Your App <noreply@yourdomain.com>',
  to: email,
  subject: 'Verify your email address',
  html: getVerificationEmailHtml(verificationLink),
})
```

Use a professional HTML template (see below) for `getVerificationEmailHtml`.

---

## Example HTML Email Template

Use a single “Verify email” button/link; keep branding minimal and clear.

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="margin:0; font-family: system-ui, sans-serif; background:#f5f5f5; padding: 24px;">
  <div style="max-width: 480px; margin: 0 auto; background:#fff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
    <h1 style="margin:0 0 16px; font-size: 22px; color:#111;">Verify your email</h1>
    <p style="margin:0 0 24px; color:#444; line-height: 1.5;">Thanks for signing up. Click the button below to verify your email and activate your account.</p>
    <p style="margin:0 0 24px;">
      <a href="{{VERIFICATION_LINK}}" style="display: inline-block; padding: 12px 24px; background:#2563eb; color:#fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Verify email address</a>
    </p>
    <p style="margin:0; font-size: 13px; color:#666;">This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
  </div>
</body>
</html>
```

Replace `{{VERIFICATION_LINK}}` with the actual `verify-email?token=...` URL.

---

## Frontend Integration

- **Create account:** `POST /auth/register` → backend returns `{ msg, email }` → frontend shows “Check your email” and “Resend verification”.
- **Verification link:** User opens `/verify-email?token=...` → frontend calls `POST /auth/verify-email` with `{ token }` → on success, show “Email verified” and optionally sign in with returned `user`/`token`.
- **Invalid/expired:** Backend returns 400 → frontend shows error and “Resend verification email” (with email input).
- **Login before verification:** Backend returns 403 with “Please verify your email…” → frontend shows that message and “Resend verification email” in the sign-in form.

All of the above are implemented in this repo (LoginModal, register page, verify-email page, and API proxies).
