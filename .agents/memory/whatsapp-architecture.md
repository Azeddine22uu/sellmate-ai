---
name: WhatsApp assistant architecture
description: Provider-neutral WhatsApp connection flow and delivery boundary for SellMate.
---

SellMate stores WhatsApp connection metadata and a sanitized catalog/settings snapshot in PostgreSQL. Browser chat and Baileys messages use the same server-side, catalog-grounded assistant engine. The API server owns the Baileys auth state, QR lifecycle, inbound listener, and outbound replies.

**Why:** Store owners asked for a free direct WhatsApp Web link instead of Meta's paid Business API, and provider credentials should never be placed in the browser.

**How to apply:** Keep Baileys sessions server-side, persist the catalog snapshot before starting a session, and route incoming messages through the shared assistant engine. Treat auth files as operational state, not application data.