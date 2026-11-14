# Party Porch system map

Recorded November 13, 2026. This describes the implementation recorded in this
session; it is not a new deployment or a live account inspection.

## Components and access boundaries

| Component | Source | Hosting and access |
| --- | --- | --- |
| Public website | `index.html`, `experiences/`, `assets/`, `terms.html`, `privacy.html` | GitHub Pages at yourpartyporch.com |
| Booking backend | `google-calendar.gs` | Existing public Apps Script web app; runs as business account |
| Customer signing | `waivers.gs`, `WaiverForm.html`, `customer/waiver.html` | Public forms; private completed records in Google Drive |
| Owner text inbox | `staff/text-inbox/Code.gs`, `Index.html`, `appsscript.json` | Separate Apps Script project; Me / Only myself |
| Customer guide | `customer/nerf-party-guide.html` | Unlisted public webpage, not authenticated |
| Referee manual | `staff/nerf-referee-manual.html` | Unlisted public webpage, not authenticated |
| Launch tracker | Separate private repository | Not served from the public website |

The `customer/` and `staff/` robots exclusions and noindex metadata discourage
indexing. They do not restrict access. The private inbox is protected by its
separate deployment and owner checks, not by its source directory name.

## Booking and deposit flow

1. The customer chooses items/date and submits the adaptive booking form.
2. The frontend uses a stable random booking ID, prevents simultaneous submits
   and reuses that ID for an unchanged retry.
3. The backend rechecks inventory under a script lock, creates a calendar entry
   and one hosted Stripe deposit invoice, then stores the invoice/hold metadata
   in private Script Properties.
4. The confirmation email delivers the invoice URL. Customer SMS requires
   recorded opt-in. Formspree remains part of request delivery.
5. The frontend polls the read-only `action=checkout` lookup by booking ID for
   the same hosted invoice. It no longer creates a second Checkout session.
6. A five-minute job reconciles stored holds. Paid invoices retain inventory;
   overdue unpaid invoices are voided before release. Stripe errors do not
   silently release inventory.

The deposit deadline is the earlier of seven days from submission or event start.
Existing deposit calculation is 50% of the estimate, rounded to whole dollars and
bounded by the existing $25 minimum/$2,000 maximum.

Stripe invoice creation uses idempotency keys, a draft invoice and an item attached
to that invoice before finalization. The integration delivers the hosted URL in
its own confirmation email rather than also calling Stripe's invoice-send endpoint.
Invoice issuance is not payment.

Release happens on the next reconciliation or relevant availability check, not
necessarily at the exact due second. Legacy/manual calendar entries are not
automatically migrated. Custom quotes remain manual requests without an automatic
invoice or inventory hold.

## Availability

Inventory is tracked by item keys in calendar descriptions. Nerf blocks its
booking date and the following day for pickup/cleaning/reset. Other items remain
independently bookable. The implementation also guards reverse-order overnight
overlaps.

The booking form retains item-specific lead times: Nerf/snack machines five days,
Movie Night seven, Yard Games ten, Water Battles fourteen, and Photo Booth,
Flower Backdrop, Soft Play and Bounce House forty-two. Short-notice agreements
are handled manually, not by silently weakening public date rules.

Closure titles containing `BLOCKED`, `CLOSED`, `UNAVAILABLE` or `VACATION` block
availability on the business booking calendar. Use an all-day event for a date
range. A closure does not cancel existing customer arrangements.

## Notifications and Contacts

Twilio credentials and sender values live in private Script Properties.
`OWNER_SMS_TO` supports multiple privately configured owner/team recipients.
Owner request alerts do not depend on whether the customer opted into SMS.

Owner reminders run around 9 AM America/Chicago at seven days before, one day
before and day-of, including eligible manual/existing events. Per-recipient
deduplication isolates failures and avoids repeating successful reminders.
Scheduled times are approximate.

Google Contacts uses the advanced People API. New requests can create contacts or
match existing contacts by email, preserving existing names/numbers and appending
usable new phone information. This is not a bulk import of old bookings.

Inbound Twilio texts continue to use the existing email-forwarding webhook.
Replying to the forwarded email does not send an SMS.

## Waivers

The public customer link is:
https://yourpartyporch.com/customer/waiver.html

The host agreement and participant/guardian waiver are separate. Each adult
participant signs for themselves; each child needs their own parent/guardian form.
Minor date of birth is required and age is calculated server-side at event date.

The host agreement includes documented repair/equivalent-replacement fees for
lost or damaged equipment, with exclusions and separate itemized invoicing. It
does not authorize automatic saved-card charges.

Signing uses server-issued version-bound tokens, typed signatures, explicit
consents and server timestamps. A private JSON journal and PDF preserve the
accepted agreement and fields. Exact retries reuse the receipt/PDF; changed data
requires a new submission. Uncertain email sends are not automatically repeated.
Signers download their copy without making the Drive folder public.

The adult signer's name and email can also be saved in private business Google
Contacts after the PDF is saved, reusing booking contact matching. Minor forms
save the guardian, not child/emergency-contact data. Failed/uncertain writes alert
the owner and preserve signing without automatically repeating the same contact
attempt. This update requires manual Apps Script deployment and is not promotional
subscription or a post-party mailing scheduler.
The owner-only `importWaiverSignerContacts` action can save adult contacts from
existing completed journals/PDFs in batches of 25 without requesting new forms.
It is a manual action, not an automatically executed historical import.

For Nerf bookings, host links go out at booking. Participant links go to the host
after a tracked deposit invoice is verified paid; a daily job sends one reminder
four days before and catches up inside that window. SMS requires recorded consent.
This sends links, not proof of signed forms, and never infers guest phone numbers.
Cash, standalone invoices and legacy Checkout payments are not inferred from
untracked payment data.

## Private inbox

The inbox reads Twilio account history and filters messages by the selected owned
SMS-capable business number. It supports SMS compose/reply, statuses, older
history, loaded-conversation search and waiver-link templates.

All browser-callable backend operations check the active business Google account.
Credentials remain server-side. No conversation or draft is stored in browser
localStorage/sessionStorage.

Each send uses an expiring signed token and a private fingerprint/receipt reserved
before the API request. Accepted or uncertain retries do not automatically create
another message. Network uncertainty is reported explicitly; inspect the
conversation and Twilio logs before a deliberate new attempt.

The inbox does not change Twilio webhooks or provision numbers. It has no offline
mode or background push notifications. MMS attachments are counted but not
previewed; outgoing composition is SMS only. Normal Twilio fees/registration rules
remain applicable.

## Deployment rules

For the public booking/waiver project, replace only the intended files, preserve
private settings/one-time actions and existing scopes, and deploy a new version
retaining its URL. Required services/scopes are documented in
[website setup](website-setup.md) and [online waivers](online-waivers.md).

For the private inbox, use its own manifest and Script Properties in its own
project. Never paste it into the public booking project or change access to
Anyone to work around a login error.

Publishing source to GitHub does not deploy Apps Script. Never commit credentials,
customer contacts, private one-time customer actions or signed records.
