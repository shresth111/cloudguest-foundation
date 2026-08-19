# Channel Partner Onboarding — Implementation Spec

Status: ready to implement. Owner: PM/design (this doc). Implementers: 1 BE
engineer, 1 FE engineer, 1 illustrator/designer (one bounded asset, see
Section 7).

## Top-line scope decision

| Surface | Verdict | Why |
|---|---|---|
| Backend domain | **New domain, `app/domains/channel_partner`.** | No "partner"/"channel_partner"/"reseller" concept exists anywhere in `cloud-guest-repo/backend` today (confirmed via repo-wide grep across every `.py` file — zero real hits; an earlier grep pass that appeared to match `billing/models.py` and two test files was a stale/false-positive result, re-verified clean with `grep -c`). This is a genuinely new domain, not an extension of `Organization`/`billing` or anything else. |
| `wyfy-guest-website` `/partners` | **No such page exists.** | `find` across the site's `src/` turns up nothing "partner"-named. There is no marketing "become a partner" page to reconcile with — nothing to confirm as static copy. |
| Master Console UI | **New page, follows the Quotations pattern almost exactly.** | `app/domains/quotation` + `master.quotations.tsx` is the closest existing feature in this codebase to what's being asked: an operator fills a form, clicks one button, the system generates a record **and** sends the recipient something in the same request, and the outcome is always visible in a list. Channel Partners reuses that shape end-to-end (model conventions, RBAC scope, router/service split, `MDialog`+`MTable` UI) rather than inventing a new one. |
| Welcome message | **New, real send — SMS always, email when provided.** | See Section 5. Reuses `app.domains.otp.service`'s already-configured Twilio SMS provider and `get_configured_email_provider`/`app.core.email_layout` — no new delivery mechanism. |
| Email visual branding | **Already correct — `email_layout.py`'s shared shell already IS the real Wyfy Guest/wyfy-guest-website brand system**, not a generic template that needs re-skinning. Verified directly (Section 5.3). | |
| Partner self-service, commission tracking, partner-facing dashboard | **Explicitly out of scope.** | Not asked for; no signal anywhere in the codebase or the ask implies it. See Section 10. |

---

## Key findings from investigation

1. **No existing partner concept, backend or frontend.** Repo-wide
   case-insensitive grep for `partner`, `channel_partner`, `reseller` across
   `cloud-guest-repo/backend/app/**/*.py` and `cloudguest-foundation/src/**`
   returns nothing real. This is a clean, new domain — no risk of
   duplicating or conflicting with something half-built.
2. **`app/domains/quotation` is the load-bearing precedent for this entire
   feature**, and matches unusually closely:
   - `Quotation` (`app/domains/quotation/models.py`) carries **no
     `organization_id`** — same reasoning applies here: a channel partner
     is Wyfy Guest's own business relationship, not a row that belongs to
     any customer `Organization`. `ChannelPartner` follows the identical
     "GLOBAL, org-independent" shape.
   - `QuotationService.create_and_send_quotation` composes "create the
     record" + "render/send the message" + "record delivery outcome on
     the row" in **one service method**, called from a **single `POST`**
     endpoint that always returns `201` — a failed/unconfigured send is
     recorded on the row (`status`/`email_error`), never a rollback of the
     already-created record. This is exactly the single-action "onboard →
     always creates the partner, welcome message outcome is separate"
     behavior the founder described, and `ChannelPartnerService` reuses it
     verbatim.
   - `master.quotations.tsx` is a complete, working example of the exact
     UI shape asked for: `MDialog` create form + `MTable` list, built from
     `MasterShell`/`MasterKit`'s shared primitives. `master.channel-partners.tsx`
     follows it file-for-file.
3. **RBAC is fully data-driven** (`app/domains/rbac/seed.py`) — a new
   module is three small, additive edits (a new `PermissionModule` enum
   value, its `MODULE_ACTIONS`/label/`MODULE_NARROWEST_SCOPE` entries, one
   `GrantLevel` decision per system role), not a bespoke permission system.
   `QUOTATIONS` is the exact template: `ScopeType.GLOBAL`, actions
   `(CREATE, READ, MANAGE)`, granted only to **Super Admin** and **Platform
   Admin** (both `FULL` by default with no override), explicitly `NONE`
   for every other seeded role including MSP Owner/Admin, Organization
   Owner/Admin, Billing Manager, and Platform Support. `CHANNEL_PARTNERS`
   copies this exactly — see Section 3.
4. **Real, working notification infrastructure already exists and needs no
   new provider work.** `app.domains.otp.service.get_configured_sms_provider`
   (Twilio SMS, `TwilioSmsProvider`) and `get_configured_email_provider`
   (SMTP or SES) are both already wired and already used by `quotation`,
   `billing`, and `otp` themselves. `app.core.email_layout` is a real,
   already-brand-correct HTML email shell (see finding 6). WhatsApp
   (`get_configured_whatsapp_provider`) is available too, but **deliberately
   not used** here — Twilio WhatsApp requires a pre-approved Content
   Template (`whatsapp_twilio_content_sid`) for any first-contact message;
   standing one up for this one welcome message is unjustified scope for
   what the founder actually asked for (see Section 5.1).
5. **No phone-number or GSTIN format validation exists anywhere in this
   codebase today.** Every existing `phone`/`contact_phone`/`phone_number`
   field (`organization`, `auth`, `location`, `user`, `demo_request`
   schemas) is `str | None = Field(max_length=20)` — free text, no pattern.
   `billing.schemas.BillingProfileUpsertRequest.gst_identifier` is likewise
   `str | None = Field(max_length=20)` with zero regex validation, despite
   the docstring example showing a real GSTIN shape
   (`"27AAAAA0000A1Z5"`). This feature is the **first** place in the
   codebase that actually validates either format — justified here because,
   unlike those informational fields, this phone number is used to place a
   real Twilio API call and this GSTIN is asserted as real government tax
   ID data, not free text. (Out of scope: retrofitting billing's laxer
   `gst_identifier` field — flagged here for visibility only.)
6. **`email_layout.py`'s brand tokens are not generic — they're already the
   real, verified Wyfy Guest brand**, sourced directly from
   `wyfy-guest-website/src/styles/global.css` and confirmed by reading that
   file directly: `--color-indigo-600: #4f46e5` (commented "dashboard
   --primary" in the site's own CSS) is `email_layout.BRAND_INDIGO`;
   `--color-indigo-500: #6366f1` ("dashboard --ring") is
   `BRAND_INDIGO_LIGHT`; `--color-ink: #1e1b4b` is `BRAND_INK`; the site's
   self-hosted `Poppins`/`Open Sans` (`@font-face` in `global.css`, woff2,
   not a Google Fonts CDN link) are `email_layout.FONT_STACK`/
   `BODY_FONT_STACK`. **The welcome email needs no re-skinning work** — it
   inherits the correct brand automatically by using `email_layout`'s
   existing helpers, the same way `quotation`'s and `otp`'s emails already
   do. What *is* genuinely new is a header illustration (see Section 5.4 /
   7) — today's shell uses a pure HTML/CSS wordmark, deliberately with **no
   image** at all (see next finding).
7. **No email in this codebase currently embeds a raster image, and there's
   a real, documented reason why.** `email_layout.py`'s own module
   docstring: Outlook desktop's Word rendering engine doesn't support
   `data:` image URIs, so the existing wordmark is rendered as HTML/CSS
   (a colored `<td>` + text), never an `<img>`. This constraint is about
   **inline/data-URI** images specifically — a normal `<img src="https://...">`
   pointing at a real, hosted URL works fine in Outlook and every other
   client. The header illustration this spec adds (Section 5.4) is
   therefore a **hosted PNG referenced by absolute HTTPS URL**, not an
   inlined/embedded asset — see Section 7 for exactly where it's hosted and
   why.
8. **There's a real, working precedent for exporting a brand SVG to a raster
   asset at build time**: `app/domains/quotation/quotation_pdf.py` embeds
   `assets/wyfy-guest-logo.png`, a one-time `rsvg-convert` export of
   `cloudguest-foundation/public/brand/lockup-horizontal.svg`, vendored
   into the repo rather than fetched at runtime. The header illustration
   (a new, custom SVG in `wyfy-guest-website`'s existing illustration
   style, not this logo) uses the same "author as SVG, export a fixed PNG"
   discipline — see Section 7.

---

## 1. Backend — data model

New domain: `app/domains/channel_partner/`, mirroring
`app/domains/quotation/`'s file layout exactly (`models.py`, `schemas.py`,
`service.py`, `repository.py`, `router.py`, `dependencies.py`,
`exceptions.py`, `constants.py`).

### 1.1 `ChannelPartner` model

```python
# app/domains/channel_partner/models.py
"""SQLAlchemy ORM model for the Channel Partner domain.

:class:`ChannelPartner` -- a Wyfy Guest channel/reseller partner a Master
console operator onboards by hand. Carries no `organization_id`, the same
"belongs to no organization" shape `app.domains.quotation.models.Quotation`
and `app.domains.demo_request.models.DemoRequest` already establish: a
channel partner is Wyfy Guest's own business relationship, never a row
scoped to (or owned by) any customer Organization.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel

from .constants import ChannelPartnerStatus


class ChannelPartner(BaseModel):
    """One onboarded channel partner. `created_at`/`created_by`
    (from `BaseModel`'s `TimestampMixin`/`AuditMixin`) already serve as this
    row's "onboarded at" / "onboarded by staff user" -- no separate
    `onboarded_at`/`onboarded_by` columns needed, the exact same "reuse the
    base audit columns, don't duplicate them" call `Quotation` makes for its
    own creation metadata."""

    __tablename__ = "channel_partners"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    # E.164, always +91-prefixed -- see schemas.py's normalize_phone. Used
    # to place a real Twilio SMS send, not just stored as contact info.
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    # Always uppercase, 15 chars, validated against the real GSTIN format
    # (see schemas.py). Unique -- a GSTIN is a real government-issued tax ID
    # legally unique per registered business, so a second partner row with
    # the same GSTIN is always a data-entry mistake, not a legitimate case.
    gst_number: Mapped[str] = mapped_column(String(15), nullable=False)

    # Simple active/inactive toggle, independent of BaseModel's own
    # soft-delete (`is_deleted`). A partner relationship can legitimately
    # end without erasing the historical record the way a delete implies --
    # same "status is a business-lifecycle concept, is_deleted is a
    # data-lifecycle concept" split `QuotationStatus` draws for its own
    # domain. No API surface toggles this in v1 (see Section 10) -- the
    # column exists now so the cheap, obvious follow-up (a deactivate
    # action) never needs a migration.
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default=ChannelPartnerStatus.ACTIVE.value
    )

    # Welcome-message delivery outcome, one pair of columns per channel --
    # mirrors Quotation.sent_at/email_error exactly, just doubled for SMS +
    # email. A failed/unconfigured send on either channel is never a
    # rollback of the partner row itself (see service.py).
    welcome_sms_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    welcome_sms_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    welcome_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    welcome_email_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_channel_partners_status", "status"),
        Index("ix_channel_partners_gst_number", "gst_number", unique=True),
        Index("ix_channel_partners_phone", "phone"),
    )

    def __repr__(self) -> str:
        return (
            f"<ChannelPartner(id={self.id}, name={self.name!r}, "
            f"gst_number={self.gst_number})>"
        )


__all__ = ["ChannelPartner"]
```

```python
# app/domains/channel_partner/constants.py
from __future__ import annotations

from enum import StrEnum

CHANNEL_PARTNER_PRODUCT_NAME = "Wyfy Guest"


class ChannelPartnerStatus(StrEnum):
    ACTIVE = "active"
    INACTIVE = "inactive"


__all__ = ["CHANNEL_PARTNER_PRODUCT_NAME", "ChannelPartnerStatus"]
```

### 1.2 GST (GSTIN) validation — real, not free text

India's GSTIN is always exactly 15 characters:
`[state code:2][PAN:10][entity code:1][default "Z":1][checksum:1]`.
Pattern (matches the founder's own spec verbatim):

```python
GSTIN_PATTERN = r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$"
```

Applied as a Pydantic `field_validator` in `schemas.py` (see 1.4) — uppercase
the input first (GSTIN is conventionally upper), then match. Rejects
anything that isn't well-formed 15-character GSTIN shape (wrong length,
lowercase-after-normalization garbage, missing the fixed `Z` at position 14,
etc.) with a `422` and a specific message, not a generic "invalid" — staff
onboarding a partner need to know *why* a pasted GSTIN was rejected.

### 1.3 Phone validation — Indian mobile, normalized to E.164

Every existing `Twilio*Provider.send` in `otp/service.py` expects a
Twilio-ready `To` number. Since a valid `gst_number` is mandatory for every
`ChannelPartner` (GST only applies to Indian-registered businesses), every
partner is implicitly India-based — so phone validation targets Indian
mobile numbers specifically rather than generic E.164:

```python
# Accepts "9876543210", "+919876543210", "919876543210" -- normalizes to
# "+919876543210" before storage, so the stored value is always
# Twilio-ready with no send-time reformatting.
INDIAN_MOBILE_PATTERN = r"^(?:\+?91)?([6-9]\d{9})$"

def normalize_indian_phone(value: str) -> str:
    match = re.match(INDIAN_MOBILE_PATTERN, value.strip())
    if not match:
        raise ValueError(
            "Enter a valid 10-digit Indian mobile number, e.g. 9876543210."
        )
    return f"+91{match.group(1)}"
```

### 1.4 Request/response schemas

```python
# app/domains/channel_partner/schemas.py
from __future__ import annotations

import re
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

GSTIN_PATTERN = re.compile(r"^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$")
INDIAN_MOBILE_PATTERN = re.compile(r"^(?:\+?91)?([6-9]\d{9})$")


class ChannelPartnerCreateRequest(BaseModel):
    """The Master console's "Onboard Partner" form submission -- create +
    onboard + trigger the welcome message, all in one request."""

    name: str = Field(..., min_length=2, max_length=255)
    phone: str = Field(..., description="10-digit Indian mobile number.")
    email: EmailStr | None = Field(
        default=None,
        description=(
            "Optional. When provided, a branded welcome email is sent in "
            "addition to the welcome SMS."
        ),
    )
    address: str = Field(..., min_length=5, max_length=2_000)
    city: str = Field(..., min_length=1, max_length=100)
    gst_number: str = Field(..., min_length=15, max_length=15)

    @field_validator("phone")
    @classmethod
    def validate_and_normalize_phone(cls, value: str) -> str:
        match = INDIAN_MOBILE_PATTERN.match(value.strip())
        if not match:
            raise ValueError(
                "Enter a valid 10-digit Indian mobile number, e.g. 9876543210."
            )
        return f"+91{match.group(1)}"

    @field_validator("gst_number")
    @classmethod
    def validate_gst_number(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not GSTIN_PATTERN.match(normalized):
            raise ValueError(
                "Enter a valid 15-character GSTIN, e.g. 27AAAAA0000A1Z5."
            )
        return normalized


class ChannelPartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    phone: str
    email: str | None
    address: str
    city: str
    gst_number: str
    status: str
    welcome_sms_sent_at: datetime | None
    welcome_sms_error: str | None
    welcome_email_sent_at: datetime | None
    welcome_email_error: str | None
    created_at: datetime
    updated_at: datetime


class ChannelPartnerListResponse(BaseModel):
    items: list[ChannelPartnerResponse]
    page: int
    page_size: int
    total_items: int
    total_pages: int
    has_next: bool
    has_previous: bool


__all__ = [
    "ChannelPartnerCreateRequest",
    "ChannelPartnerResponse",
    "ChannelPartnerListResponse",
]
```

### 1.5 Service layer — composition, same shape as `QuotationService`

```python
# app/domains/channel_partner/service.py (shape; full body mirrors
# QuotationService.create_and_send_quotation/_send_quotation_email almost
# line for line -- see that file for the exact resilience pattern to copy)

class ChannelPartnerService:
    def __init__(
        self,
        repository: ChannelPartnerRepositoryProtocol,
        *,
        sms_provider: SmsProviderProtocol | None = None,
        email_provider: EmailProviderProtocol | None = None,
    ) -> None:
        self.repository = repository
        self.sms_provider = sms_provider
        self.email_provider = email_provider

    async def onboard_partner(
        self, *, actor_user_id: uuid.UUID | None, data: ChannelPartnerCreateRequest
    ) -> ChannelPartner:
        partner = await self.repository.create(
            name=data.name.strip(),
            phone=data.phone,  # already normalized by the schema validator
            email=data.email,
            address=data.address.strip(),
            city=data.city.strip(),
            gst_number=data.gst_number,  # already normalized
            status=ChannelPartnerStatus.ACTIVE.value,
            created_by=actor_user_id,
        )
        partner = await self._send_welcome_sms(partner)
        if partner.email:
            partner = await self._send_welcome_email(partner)
        return partner
```

`_send_welcome_sms`/`_send_welcome_email` follow
`QuotationService._send_quotation_email`'s exact structure: check for a
bare `LoggingSmsProvider`/`LoggingEmailProvider` (no real provider
configured → record an honest "not configured" error, never a fabricated
success), `try`/`except` around the real send, write
`welcome_sms_sent_at`/`welcome_sms_error` (or the email pair) on success or
failure. **The partner row is always created and returned regardless of
either channel's outcome** — `POST /channel-partners` always `201`s; the
response body's `welcome_sms_error`/`welcome_email_error` tell the operator
if a channel needs a manual follow-up.

`dependencies.py` wires `get_configured_sms_provider`/
`get_configured_email_provider` exactly like
`quotation/dependencies.py` wires the email provider — same
`try/except *NotConfiguredError → None` fallback (`_resolve_email_provider`)
duplicated for SMS.

### 1.6 Migration

Next migration after `0085_add_portal_pin_login.py` →
`0086_create_channel_partners_table.py`, using the same
`_base_model_columns()`/`_create_base_model_indexes()` self-contained
helpers `0082_create_quotations_tables.py` defines inline (Alembic
migrations in this repo don't import each other — see that file's own
comment):

```python
def upgrade() -> None:
    op.create_table(
        "channel_partners",
        *_base_model_columns(),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("address", sa.Text(), nullable=False),
        sa.Column("city", sa.String(100), nullable=False),
        sa.Column("gst_number", sa.String(15), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("welcome_sms_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("welcome_sms_error", sa.Text(), nullable=True),
        sa.Column("welcome_email_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("welcome_email_error", sa.Text(), nullable=True),
        sa.UniqueConstraint("gst_number", name="uq_channel_partners_gst_number"),
    )
    _create_base_model_indexes("channel_partners")
    op.create_index("ix_channel_partners_status", "channel_partners", ["status"])
    op.create_index(
        "ix_channel_partners_gst_number", "channel_partners", ["gst_number"], unique=True
    )
    op.create_index("ix_channel_partners_phone", "channel_partners", ["phone"])
```

`downgrade()` mirrors `0082`'s: drop the three extra indexes, drop the base
indexes, drop the table.

No RBAC FK follow-up migration needed — same note `0082`/`0062` both make:
`PermissionModule.CHANNEL_PARTNERS` is seeded at `ScopeType.GLOBAL`, no
per-row scope column required.

---

## 2. Backend — RBAC

Three additive edits to `app/domains/rbac/`, following `QUOTATIONS`'s
exact treatment at every one of its 4 touch points.

**`enums.py`** — add one `PermissionModule` value, right after
`READINESS` (the module's most recently added entry):

```python
    # Channel Partner onboarding: a Master console operator onboards a new
    # channel/reseller partner (name/phone/address/city/GSTIN) and the
    # system sends them a real welcome message in the same action. GLOBAL-
    # only, identical "belongs to no organization" profile as QUOTATIONS/
    # DEMO_REQUESTS above -- a channel partner is Wyfy Guest's own business
    # relationship, never scoped to a customer Organization.
    CHANNEL_PARTNERS = "channel_partners"
```

**`seed.py`** — three entries, each placed next to `QUOTATIONS`'s own:

```python
# MODULE_ACTIONS (next to QUOTATIONS' entry, ~line 433):
# Channel Partners: CREATE covers the one-shot "onboard + send welcome
# message" action (no separate draft step, same reasoning QUOTATIONS'
# own comment gives), READ covers list/get, MANAGE is the catch-all for
# the future deactivate/reactivate action (see models.py's `status`
# column comment -- no API surface for it yet).
PermissionModule.CHANNEL_PARTNERS: (_A.CREATE, _A.READ, _A.MANAGE),
```

```python
# PERMISSION_MODULE_LABELS (next to QUOTATIONS, ~line 501):
PermissionModule.CHANNEL_PARTNERS: "Channel Partners",
```

```python
# MODULE_NARROWEST_SCOPE (next to QUOTATIONS, ~line 622):
# A channel partner belongs to no organization/location/router at all --
# identical ScopeType.GLOBAL reasoning as PermissionModule.QUOTATIONS'
# own entry above.
PermissionModule.CHANNEL_PARTNERS: ScopeType.GLOBAL,
```

**`SYSTEM_ROLES`** — add `_M.CHANNEL_PARTNERS: _L.NONE` to the exact same
override blocks that already carry `_M.QUOTATIONS: _L.NONE` (Platform
Support, Billing Manager, MSP Owner, MSP Admin, Organization Owner,
Organization Admin — the six `overrides={...}` blocks around lines 803,
829, 869, 897, 1113, 1135 in the current file). Every other role
(Network Administrator, Network Engineer, Office Admin, Location Manager,
Reception Staff, Helpdesk, Read Only, Auditor, Guest Operator) never had
`QUOTATIONS` in its overrides at all — its module-wide `default_level` is
already `NONE`/`READ` and doesn't reach a GLOBAL-only module regardless, so
`CHANNEL_PARTNERS` needs no override there either. **Net effect, identical
to `QUOTATIONS` today: only Super Admin and Platform Admin (both `FULL`
default, no override) can onboard or view channel partners.** This is the
right answer for "internal staff only, definitely not a customer/org-admin
action" — it's the same two roles trusted with quotations, invoicing-adjacent
work, and platform-wide settings.

After merging, run `python -m app.domains.rbac.seed` (idempotent, safe to
re-run) against every environment — no Alembic migration carries RBAC data,
`seed_rbac` is the actual mechanism (see `seed.py`'s own module docstring).

---

## 3. Backend — API contract

Router mounted at `/channel-partners`, registered in
`app/api/v1/router.py` exactly like quotation's:
`api_v1_router.include_router(channel_partner_router)`.

### `POST /channel-partners`
Gated by `RequirePermission("channel_partners.create")`. Body:
`ChannelPartnerCreateRequest` (Section 1.4). **Always returns `201`** with
the created partner — a failed/unconfigured SMS or email send is reflected
in `welcome_sms_error`/`welcome_email_error` on the response body, never a
non-2xx. Response `message` mirrors quotation's conditional phrasing:

```
"{name} onboarded — welcome SMS sent to {phone}" (+ "and email sent to {email}" if applicable)
```
or, if a channel failed:
```
"{name} onboarded, but the welcome SMS could not be sent" (per-channel wording)
```

### `GET /channel-partners`
Gated by `RequirePermission("channel_partners.read")`. Query params:
`page`, `page_size` (default 25, max 100 — same as quotations), `status`
(optional filter), `search` (optional — matches name/phone/email/city/
gst_number). Returns `ChannelPartnerListResponse`.

### `GET /channel-partners/{id}`
Gated by `RequirePermission("channel_partners.read")`. Returns
`ChannelPartnerResponse` or `404` (`ChannelPartnerNotFoundError`, same
shape as `QuotationNotFoundError`).

`exceptions.py`: `ChannelPartnerError` (base, subclasses
`CloudGuestError`), `ChannelPartnerNotFoundError` (404),
`DuplicateGstNumberError` (409 — raised when the unique constraint on
`gst_number` is violated; give the operator a clear "a partner with this
GSTIN is already onboarded" message rather than a raw DB integrity error).

---

## 4. Frontend — Master Console

### 4.1 Nav entry

`src/components/master/MasterShell.tsx` — add one `MASTER_NAV` entry (a
`Handshake` or `Building2`-style icon from `lucide-react`; suggest
`Handshake` since `Building2` is already used for Customers) and one
`CAP_PERMISSIONS` entry, plus a `MASTER_NAV_GROUPS` placement under
**"Growth"** (next to Customers/Locations/Billing — a channel partner is a
growth-side relationship, same grouping logic already used there):

```ts
// MASTER_NAV, after the Customers entry:
{ to: "/master/channel-partners", label: "Channel Partners", icon: Handshake, cap: "channel-partners" },

// CAP_PERMISSIONS:
"channel-partners": ["channel_partners.read"],

// MASTER_NAV_GROUPS, "Growth" items array:
items: ["/master", "/master/customers", "/master/channel-partners", "/master/locations", "/master/billing"],
```

The page itself gates the create action separately (`can("channel_partners.create")`
around the "Onboard Partner" button) the same way `master.quotations.tsx`
doesn't need a separate cap for its own create dialog — read access already
implies the nav item is visible; the button's own disabled/hidden state is
a page-level `useAuth().can()` check, not a second nav cap.

### 4.2 New route: `src/routes/master.channel-partners.tsx`

File-for-file structural copy of `master.quotations.tsx` (Section imports
from `@/components/master/MasterKit`, `MasterShell`, `sonner`'s `toast`):

- **Stat row** (`MStat` x4): Total Partners, Active, Onboarded This Month,
  Welcome Message Failures (partners where either `welcomeSmsError` or
  `welcomeEmailError` is set — surfaces exactly the "needs manual
  follow-up" case quotations' own "Failed" stat surfaces).
- **Filter/search bar**: `MSeg` (All/Active/Inactive), search input
  (name/phone/email/city/GST).
- **`MTable`**: Name, Phone, City, GST Number (mono), Status (`MTag`),
  Onboarded (created_at, formatted).
- **"Onboard Partner" `MButton`** → `MDialog` with `MField`-wrapped inputs
  for name/phone/email/address/city/gst_number.
- **Client-side GST validation before submit** — same regex as the
  backend, uppercased on blur, inline error text under the field (don't
  let a malformed GSTIN reach the network call at all; the backend
  validator is the real source of truth, this is UX only):

  ```ts
  const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}$/;
  function isValidGstin(value: string): boolean {
    return GSTIN_PATTERN.test(value.trim().toUpperCase());
  }
  ```
- **Client-side phone validation**, same 10-digit Indian mobile pattern as
  the backend's `INDIAN_MOBILE_PATTERN`, with the same error copy.
- On submit success: same conditional toast pattern as quotations —
  `toast.success` if both configured channels sent cleanly, `toast.warning`
  with the specific per-channel error as `description` if either failed
  (the partner row still gets added to the table either way — a failed
  welcome message is never a failed onboarding).
- **Detail drawer** (`MDrawer`) on row click: full address, GST number,
  both welcome-message outcomes (sent-at timestamps or error text per
  channel), matching quotations' own drawer layout conventions
  (`info_box`-style bordered rows).

### 4.3 `src/types/channel-partner.ts` and `src/services/channel-partner.service.ts`

Same `Backend*`/domain-type split and `snake_case` ↔ `camelCase` mapping
`quotation.service.ts` uses (`toChannelPartner`), same `createAndOnboard`
naming convention as `createAndSend`. `list()` takes `{ status?, search? }`
params exactly like `quotationService.list`.

---

## 5. Welcome message design

### 5.1 Channel decision: SMS always, email when provided

- **Phone is a required field** → SMS delivery is guaranteed possible for
  every onboarded partner. Reuses `TwilioSmsProvider` — zero new provider
  work, same account already sending OTPs.
- **Email is optional on the form** (not one of the founder's five named
  fields) but strongly worth collecting: a plain SMS reads transactional
  and thin for what is, for the partner, the start of a real business
  relationship; a branded HTML email is the appropriate register for that.
  Made optional rather than required specifically to avoid over-scoping
  past what the founder asked for — staff can onboard a partner from just
  a phone call's worth of information, and the email arrives later if/when
  it's known (no separate "add email later" flow needed for v1 — MANAGE
  covers a future edit action, out of scope for now, see Section 10).
- **WhatsApp is not used** — see Key Finding 4: Twilio WhatsApp requires an
  approved Content Template for a first-contact (session-opening) message;
  standing that up is real, separate scope this feature doesn't need.

### 5.2 Welcome SMS copy

```
Welcome to Wyfy Guest, {name}! You're onboarded as a channel partner.
Our team will be in touch shortly with next steps. Questions? Reply to
this message or contact partners@wyfyguest.com.
```

Kept short and plain per SMS norms (~230 chars, single-segment) — no
GSTIN/address echoed back (SMS is not the place for a compliance
confirmation, and echoing sensitive business data back over unencrypted
SMS is unnecessary).

### 5.3 Welcome email — real copy, built from `email_layout.py`

Uses the existing shared shell/blocks directly — no new email design
system, no re-skinning needed (Key Finding 6). Subject:
`"Welcome to Wyfy Guest, {name}"`.

```python
content = (
    heading(f"Welcome aboard, {esc(partner.name)}")
    + welcome_header_illustration()  # see 5.4 -- new block, additive only
    + paragraph(
        "Thank you for partnering with Wyfy Guest. We're excited to work "
        "with you to bring guest WiFi to more venues."
    )
    + info_box(
        [
            ("Partner", esc(partner.name)),
            ("City", esc(partner.city)),
            ("GSTIN", esc(partner.gst_number)),
        ],
        mono_values=True,
    )
    + paragraph(
        "Our partnerships team will reach out shortly with next steps -- "
        "onboarding materials, pricing, and how to start referring venues.",
    )
    + paragraph(
        "In the meantime, if you have any questions, just reply to this "
        "email or reach us at partners@wyfyguest.com.",
        muted=True,
    )
)
body = render_email(
    preheader=f"You're onboarded as a Wyfy Guest channel partner, {partner.name}.",
    content_html=content,
)
```

This is a strict **addition** to `email_layout.py`: one new content-block
function, `welcome_header_illustration()`, following the exact shape of
the existing `button()`/`code_block()` helpers (returns an HTML string,
inlined styles, no external CSS). Every other block used above
(`heading`, `paragraph`, `info_box`, `esc`, `render_email`) is reused
as-is, unmodified — the brand shell doesn't change, one block is added to
it.

### 5.4 Header illustration — what's new, and the real constraint

The founder wants a simple branded "welcome aboard" header graphic instead
of the plain wordmark this email would otherwise fall back to. Per Key
Finding 7, this must be a **hosted PNG referenced by absolute HTTPS URL**,
not an inlined SVG or `data:` URI — most email clients (Outlook chief among
them) don't reliably render inline SVG, and this codebase's own
`email_layout.py` docstring already documents exactly why `data:` URIs are
a dead end for Outlook specifically. See Section 7 for the illustrator's
scoped deliverable and export pipeline; the block function itself is a
three-line addition once the asset exists:

```python
def welcome_header_illustration() -> str:
    """A small branded header image for the channel-partner welcome email
    -- a hosted PNG (2x/retina export), never an inline SVG or data: URI
    (see module docstring's Outlook constraint). Degrades to nothing (not
    a broken-image icon) if the client blocks remote images -- alt text
    carries the meaning, and the wordmark immediately below still renders
    regardless."""
    url = "https://wyfyguest.com/brand/email/welcome-partner-header.png"
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
        <tr>
          <td align="center">
            <img src="{url}" width="240" height="120" alt="Welcome to Wyfy Guest" style="display:block;max-width:240px;width:100%;height:auto;border:0;">
          </td>
        </tr>
      </table>"""
```

---

## 6. BE / FE / Illustrator split

| Track | Owns | Key deliverables |
|---|---|---|
| **Backend** (1 engineer) | `app/domains/channel_partner/*`, migration `0086`, `rbac/enums.py` + `rbac/seed.py` edits, `email_layout.welcome_header_illustration()` | Model/schemas/service/repository/router/dependencies/exceptions/constants; GSTIN + Indian-mobile validators (with unit tests — see below); RBAC seed re-run; SMS+email send wired through the existing configured providers, both channels' failure paths tested with fake providers (mirrors `QuotationService`'s own test doubles, per that module's docstring). |
| **Frontend** (1 engineer) | `master.channel-partners.tsx`, `MasterShell.tsx` nav edit, `types/channel-partner.ts`, `services/channel-partner.service.ts` | Onboard form + list/detail table per Section 4; client-side GSTIN/phone validation mirroring the backend regexes exactly; wait on the real `POST /channel-partners` response contract (Section 3) rather than mocking ahead of the backend — the response `message`/`welcome_*_error` fields drive the toast/detail-drawer UI directly. |
| **Illustrator / Design** (1 person, bounded) | One header illustration | See Section 7 — single deliverable, single review pass, no ongoing design system work. |

**Sequencing**: RBAC seed + migration + backend endpoints first (frontend
needs the real response shape to build against, not a guess). The
illustration track is fully parallel and non-blocking — `email_layout.py`
ships with a text-only fallback (skip `welcome_header_illustration()`
entirely, or point it at a placeholder) until the asset lands, then it's a
one-line swap.

**Unit tests to write** (backend): GSTIN validator (valid GSTIN accepted;
wrong length, lowercase-after-normalize garbage, wrong fixed-`Z` position,
non-alphanumeric all rejected with clear messages); phone normalizer (bare
10-digit, `+91`-prefixed, `91`-prefixed all normalize to the same E.164
value; a landline-shaped or too-short number rejected); service-layer
"SMS fails / email fails / both fail / both succeed / no email provided"
matrix against fake `SmsProviderProtocol`/`EmailProviderProtocol` — the
same fake-provider approach `QuotationService`'s own docstring documents
using for the identical reason (no real Twilio/SMTP call in a unit test,
no FastAPI app boot needed either).

---

## 7. Illustrator/Design track — scoped deliverable

**Deliverable**: one header illustration for the channel-partner welcome
email — a small "welcome aboard" motif (e.g. a handshake, a door opening,
a simple figure + signal/wifi mark — final concept at the illustrator's
discretion), in the **same custom flat-shape, indigo/violet-palette SVG
illustration style** already established by
`wyfy-guest-website/src/components/illustrations/*.astro` (e.g.
`PresenterIllustration.astro`, `HotelVenueIllustration.astro`) — not a
stock photo, not a generic clipart welcome banner.

**Why this can't just be an inline SVG (the constraint to design around)**:
most email clients — Outlook chief among them — do not reliably render
inline `<svg>` or `data:` image URIs at all (this is exactly the reason
`email_layout.py`'s existing wordmark is plain HTML/CSS, never an image —
see Key Finding 7). A header illustration therefore has to ship as a
**raster export**, not inline markup.

**Recommended pipeline** (mirrors the real, working precedent
`app/domains/quotation/quotation_pdf.py` already establishes for exporting
a brand SVG to a fixed PNG via `rsvg-convert` at build time — see Key
Finding 8, though that specific file embeds its PNG into a PDF, not an
email):

1. Author the illustration as a real SVG, `viewBox`-based, indigo/violet
   palette matching `wyfy-guest-website`'s existing tokens (`--color-indigo-600
   #4f46e5`, `--color-violet-500`, etc. — same palette
   `email_layout.py`/the site's illustrations already share).
2. Export a **fixed PNG at 2x** (e.g. final display size 240×120 → export
   480×240) for retina-sharp rendering in mail clients that don't
   downscale cleanly — the same "export once, ship the raster, don't
   regenerate at request time" discipline `quotation_pdf.py`'s own logo
   asset already follows.
3. **Host it as a real, publicly reachable HTTPS URL** — the backend has
   no general static-file serving today (confirmed: no `StaticFiles`
   mount in `app/main.py`; the one precedent, `branding/router.py`'s
   uploaded-logo serving, is a per-organization authenticated proxy
   endpoint over object storage, the wrong shape for one fixed shared
   asset used by an unauthenticated `<img>` tag in an email). The
   pragmatic choice: host it as a plain static file under
   `wyfy-guest-website`'s own `public/` (e.g.
   `public/brand/email/welcome-partner-header.png`), deployed the same
   manual-rsync-to-the-Azure-VM path that site's other static assets
   already use — reachable at
   `https://wyfyguest.com/brand/email/welcome-partner-header.png`, exactly
   the URL `welcome_header_illustration()` (Section 5.4) references. No
   backend changes needed to host it.
4. **Confirm it actually renders correctly across real email clients**
   before calling this done — at minimum Gmail (web + Android), Apple
   Mail (macOS + iOS), and Outlook desktop (the client most likely to
   surprise you: remote images are commonly blocked by default there
   too, which is exactly why the `<img>` block above has real `alt` text
   and the illustration is decorative, not load-bearing — the email must
   read completely fine with the image blocked). A free multi-client
   screenshot tool (e.g. Litmus/Email on Acid) or simply sending real test
   sends to a Gmail + an Outlook.com + an iCloud address covers this
   without new tooling investment.

**Explicitly not this track's job**: no illustration system, no icon set,
no additional email templates beyond this one header — a single asset,
confirmed rendering correctly, done.

---

## 8. File/component summary (for engineers to work from directly)

| File | Status |
|---|---|
| `app/domains/channel_partner/models.py` | New |
| `app/domains/channel_partner/constants.py` | New |
| `app/domains/channel_partner/schemas.py` | New |
| `app/domains/channel_partner/service.py` | New |
| `app/domains/channel_partner/repository.py` | New |
| `app/domains/channel_partner/router.py` | New |
| `app/domains/channel_partner/dependencies.py` | New |
| `app/domains/channel_partner/exceptions.py` | New |
| `alembic/versions/0086_create_channel_partners_table.py` | New |
| `app/domains/rbac/enums.py` | Edit — 1 new `PermissionModule` value |
| `app/domains/rbac/seed.py` | Edit — `MODULE_ACTIONS`, labels, `MODULE_NARROWEST_SCOPE`, 6 role overrides |
| `app/api/v1/router.py` | Edit — register `channel_partner_router` |
| `app/core/email_layout.py` | Edit — add `welcome_header_illustration()` block |
| `src/routes/master.channel-partners.tsx` | New |
| `src/components/master/MasterShell.tsx` | Edit — nav item + cap + group placement |
| `src/types/channel-partner.ts` | New |
| `src/services/channel-partner.service.ts` | New |
| `wyfy-guest-website/public/brand/email/welcome-partner-header.png` | New (illustrator deliverable) |

---

## 9. Explicitly out of scope for this rollout

- **Partner self-service login/portal.** No auth surface, no partner-facing
  UI of any kind. Nothing in the ask implies this, and RBAC (Section 2)
  deliberately keeps this GLOBAL/staff-only, the same posture quotations
  and demo requests already take.
- **Commission tracking, referral attribution, payouts.** Not asked for;
  would need its own data model (referred organizations, commission
  rates, payment runs) — a real, separate-sized project.
- **Editing an onboarded partner's details, or a deactivate/reactivate
  endpoint.** The `status` column and `MANAGE` permission action exist to
  make this a cheap follow-up (no migration needed later), but no `PATCH`
  endpoint or UI ships in this rollout — the founder's ask is "onboard,"
  not "manage."
- **WhatsApp welcome message.** Would require provisioning a new approved
  Twilio Content Template — real, separate scope (see Section 5.1).
- **Bulk import / CSV upload of partners.** One-at-a-time onboarding via
  the form only, matching "staff should be able to enter a new channel
  partner's details... and click onboard" as given.
- **Retrofitting `billing.schemas.BillingProfileUpsertRequest.gst_identifier`
  with the same real GSTIN validation.** Flagged in Key Finding 5 for
  visibility; a real gap, but touching billing's existing, already-shipped
  validation is separate scope from this feature.
