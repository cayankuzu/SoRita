# SoRita Security Rules

All AI-assisted code changes in this repository must comply with [SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md).

Minimum requirements:

- Keep secrets server-side only. Never hardcode or expose private keys in client code.
- Route sensitive auth, media, and maps operations through the hardened edge-function layer.
- Enforce server-side validation, rate limiting, structured logging, and client-safe error handling.
- Preserve explicit CORS allowlists and security headers on external-facing endpoints.
- Do not weaken upload validation, signed-request checks, or account lockout protections.
- Before merging, run `npm run typecheck` and `npm run security:verify`.
