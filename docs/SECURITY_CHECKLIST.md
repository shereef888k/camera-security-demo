# Security & Privacy Checklist

This document details the security controls, privacy-by-design patterns, and threat mitigations implemented across the Camera Security Demonstration platform.

---

## 1. Consent Architecture & Ethical Demonstration Standard

- [x] **Explicit Consent Gate**: The camera hardware stream is never activated upon merely visiting a link. The visitor must first view the educational disclaimer and actively click **"Start Camera Demonstration"**.
- [x] **No Automatic Capture**: The platform never captures images automatically in the background. Capturing requires a deliberate click on **"Capture Photo"**.
- [x] **Photo Review Before Dispatch**: Captured images are displayed directly to the visitor in a review viewport. The visitor can examine the exact image, retake it, or cancel before any data leaves the device.
- [x] **Explicit Transmission Action**: Photos are dispatched to Telegram only when the visitor explicitly clicks **"Submit Photo to Telegram"**.
- [x] **Cancellation & Cleanup**: Clicking "Cancel" or navigating away instantly calls `track.stop()` on all video tracks, turning off camera hardware lights immediately.
- [x] **Transparent Education**: The visitor interface clearly explains where the photo is delivered (the administrator's Telegram chat) and for what purpose.

---

## 2. Secrets Management & Credential Protection

- [x] **Strict Separation of Secrets**: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and `ADMIN_API_KEY` reside exclusively in backend environment variables (`.env`).
- [x] **No Secrets in Frontend Artifacts**: `config.js`, `app.js`, `demo.js`, and HTML files contain zero credentials, chat IDs, or API keys.
- [x] **Repository Protection**: `.gitignore` strictly excludes `.env`, `*.key`, `*.pem`, and local database files.
- [x] **API Response Sanitization**: Public session endpoints (`GET /api/sessions/:id`) expose only non-sensitive metadata (`id`, `label`, `status`, `expiresAt`). The bot token and chat ID are never returned in any response.

---

## 3. Session Security & Access Controls

- [x] **Cryptographically Secure Random IDs**: Session identifiers are generated using `crypto.randomBytes(16).toString('hex')`, preventing ID enumeration or guessing.
- [x] **Time-Bounded Lifespan**: Every session has an explicit `expires_at` timestamp (default 15–30 minutes). Expired sessions are rejected automatically with `410 Gone`.
- [x] **Single-Use Enforcement**: Once a photo is successfully delivered, the session status transitions to `submitted`. Subsequent upload attempts are rejected with `409 Conflict`.
- [x] **Administrator Revocation**: Administrators can invalidate any active link instantly via `POST /api/sessions/:id/revoke`.
- [x] **Timing-Safe Admin Authentication**: Admin API keys are validated using `crypto.timingSafeEqual` to prevent side-channel timing attacks.

---

## 4. Network & Input Validation Controls

- [x] **In-Memory Photo Processing**: Photos are held in volatile RAM buffers (`multer.memoryStorage()`) and forwarded directly to the Telegram API. Photographs are never written to disk.
- [x] **Strict MIME Type Whitelisting**: Only `image/jpeg`, `image/png`, and `image/webp` are accepted. Executables, scripts, and non-image payloads are rejected with `400 Bad Request`.
- [x] **Payload Size Limits**: Strict 10 MB upload ceiling enforced by Multer. Oversized uploads return `413 Payload Too Large`.
- [x] **Rate Limiting**:
  - Global API limiter: 200 requests / 15 minutes.
  - Photo submission limiter: 20 submissions / 15 minutes per IP.
- [x] **CORS Whitelisting**: Cross-Origin Resource Sharing is locked to the configured `FRONTEND_ORIGIN` in production. Unapproved origins receive `403 Forbidden`.
- [x] **HTTP Security Headers**: Powered by `helmet`, enforcing `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, and cross-origin resource isolation.

---

## 5. Client-Side Hardware & Browser Safety

- [x] **Secure Context Requirement**: Enforces `window.isSecureContext === true` (HTTPS or localhost).
- [x] **Standard Web APIs**: Relies strictly on standard `navigator.mediaDevices.getUserMedia()`. No deceptive plugins, permissions workarounds, or obfuscated payloads.
- [x] **Canvas Image Optimization**: Photos are scaled down to a maximum dimension of 1280px and compressed to JPEG (quality 0.85) prior to transmission, saving mobile bandwidth and removing unnecessary sensor metadata.
- [x] **Tab Visibility / Lifecycle Cleanup**: Listens to `beforeunload`, `pagehide`, and `visibilitychange` to release camera hardware if the user navigates away or hides the tab.
