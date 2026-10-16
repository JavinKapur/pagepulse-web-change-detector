# Security Policy

PagePulse takes security, SSRF prevention, and sensitive configuration protection very seriously.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please do NOT file a public issue. Instead, report it privately to:

- **Email:** javinkapur1@gmail.com
- **Subject:** `[SECURITY] PagePulse Vulnerability Report`

Please include:
1. Detailed description of the vulnerability.
2. Steps to reproduce or proof-of-concept.
3. Potential impact on PagePulse instances or monitored targets.

## Security Architecture Highlights

1. **SSRF Defense:** All user-provided URLs undergo strict protocol, port, IPv4/IPv6 private/loopback/cloud-metadata checks prior to any browser navigation and at every HTTP redirect.
2. **Secrets Encryption:** Webhook URLs, bot tokens, and notification provider credentials are encrypted at rest using AES-256-GCM with versioned keys.
3. **Tenant Isolation:** All database queries require authenticated user context. Direct object ID tampering across users is rejected at the API layer.
4. **Isolated Browser Execution:** Playwright runs inside unprivileged containers without access to user cookies or authenticated site sessions.
