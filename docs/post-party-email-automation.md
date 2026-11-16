# Automatic post-party emails

Status: implemented and locally tested, **not installed or enabled**. No attendee
email was sent. A ZIP code alone is not a valid sender mailing address; leave
sending disabled until a full valid business postal address or PO box is supplied.
Do not put the private address, recipients or signed records in the public repo.

## Owner-selected behavior

- Run daily around 9 AM Houston time, two calendar days after the party.
- Treat past, uncancelled calendar parties as having happened. This is an owner
  assumption, not independent attendance verification. Mark cancellations and
  remove/correct non-attendee waiver records before the follow-up runs.
- Email only adult host/participant/guardian **waiver signers for that party**,
  once per adult email address per party. Do not send to every Contact or add a
  booking host who did not sign a waiver.
- Reuse the colorful thank-you style, booking link and independent honest Google
  review request. Use Nerf-specific wording for Nerf parties and neutral wording
  for other rentals.
- Include NERFTHANKS10 only before its booking deadline ends. From January 1,
  2027, 00:00 Houston time onward, omit the expired code and discount promise
  from newly generated emails. The evergreen thank-you/review request continues.

The waiver forms and signature consents are unchanged. Waiver signing does not
establish marketing opt-in; this is the owner's opt-out approach. Required sender
disclosures, applicable privacy promises/laws and Google's sending policies still
apply. The [FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business)
explains postal address and opt-out requirements.

## Audience matching and exclusions

The script reads private completed waiver JSON records with their matching PDFs,
not the entire Google Contacts address book. It uses only adult signer email
addresses for delivery; no child or emergency-contact details appear in emails
or recipient previews.

The calendar must identify the event with an `Items:` line (the normal booking
format), or Nerf wording. Closure, cancellation, pickup, cleaning, quote and test
titles are excluded. `Status: cancelled` / `Status: canceled` also excludes an
event. A tracked booking must have `paid` status; failed, unpaid or released
holds do not become promotional audiences. Manual qualifying calendar parties
remain supported.

For each signer, the event date must match. A nonempty waiver booking reference
must uniquely match an event's `Booking ID:`, `Booking reference:`, `Reference:`,
calendar event ID, or the existing generated host/date reference. No fuzzy
name matching is attempted. With a blank reference, a date can match only when
exactly one party exists that day. Cancelled parties still count as candidates
so their signers cannot be reassigned to another party on the same date.
Ambiguous, missing, incomplete or malformed records are held for owner review.

Events with no matching adult signers get no email. A normal booking email or
Contacts membership alone never supplies a recipient.

## Installation: existing public booking project only

Keep the separate private text-inbox project unchanged.

1. Replace **Code.gs** with the latest `google-calendar.gs` (adds unsubscribe
   routing; it retains the live discount implementation).
2. Add a Script named **PostPartyAutomation** and paste `post-party-email.gs`.
3. Add an HTML file named **PostPartyEmail** and paste `PostPartyEmail.html`.
4. Keep Pricing.gs, Waivers.gs, WaiverForm.html, existing services and properties.
   Save and deploy a **new version of the existing Me/Anyone web app**.
   Do not create a new URL or run unrelated installers.
5. In **Project Settings -> Script Properties**, configure the values below.
6. Run **previewPostPartyEmails**. Its log links to a private Drive preview of
   calendar matches, adult addresses, review issues and a styled sample.
   This action needs no mailing address and sends nothing. Recipient counts
   are explicitly before stored opt-outs and previous deliveries; the actual
   sender rechecks those and may send fewer messages.
7. Once a full address exists, run **sendPostPartyTestEmail**. It emails only
   the business account. Inspect Gmail, footer, booking/review links, and follow
   the unsubscribe link through confirmation. This suppresses the test address,
   not attendee addresses. Acceptance by MailApp is not proof of inbox delivery.
8. Only after inspecting the test, run **installPostPartyEmails**. It creates
   one daily trigger and enables future scheduled sends; installation itself
   sends no attendee email. Do not enable until prior opt-outs are recorded.

No new Google service or OAuth scope is expected beyond the existing booking/
waiver project's Drive, MailApp, Calendar, external-fetch and trigger access.
The installer requests existing authorization if needed and checks the deployed
unsubscribe route before enabling.

| Private Script Property | Value |
| --- | --- |
| `POST_PARTY_MAILING_ADDRESS` | Full valid business postal address or registered PO box; never ZIP alone |
| `POST_PARTY_WEBAPP_URL` | Existing public booking URL ending in `/exec`; no query string |
| `POST_PARTY_START_DATE` | Earliest party date eligible for follow-up, `YYYY-MM-DD`; defaults at install to two days before today |
| `POST_PARTY_PREVIEW_DATE` | Optional date to preview; defaults to two days before today |
| `POST_PARTY_SUPPRESS_EMAILS` | Optional prior/reply opt-outs, separated by commas, semicolons or whitespace |

For the owner's requested November 14, 2026 party, preview date/start date can be
`2026-11-14`. The date does not prove which people attended; review the private
preview before enabling. The code intentionally does not auto-mail an unlimited
history when installed.

## Unsubscribes and replies

Every sent email has a tokenized HTTPS unsubscribe link with no raw email
address in its URL. Opening it shows a confirmation form without changing
preferences; confirming immediately stores the opt-out. This avoids email-link
scanners accidentally unsubscribing someone. No Google login is required.

Confirmed opt-outs apply to every future promotional party email, even after the
same adult signs another waiver. They do not stop operational booking/waiver
messages or alter agreements. Links do not expire and continue to work when the
scheduler is disabled. Preserve the existing deployment and private preference
files; do not delete them as part of routine cleanup.

Reply-based requests still need owner handling: add those addresses to
`POST_PARTY_SUPPRESS_EMAILS`, then run **savePostPartyOptOuts**. It records
permanent suppression without sending any email and works while scheduling is
disabled. The scheduled job also records this list before sending. Removing an
address from the property does not undo its saved opt-out. Process requests
promptly and within the applicable deadline; no inbox-reading permission or
automatic reply parsing is introduced.

## Retries, catch-up and safety

Private `post-party-contact-*.json` preference files and
`post-party-delivery-*.json` delivery journals live inside the already-private
signed-waiver folder. The existing Contact importer ignores them. Preview files
are private, too; never share the folder or publish these records.

Each delivery is claimed under the booking script lock before calling MailApp.
Successful, interrupted and uncertain sends are not automatically repeated.
MailApp does not provide an idempotency key or prove final delivery; inspect
Gmail Sent and the private journal before any manual retry. Failures/review items
are logged and reported to the owner rather than treated as sent.

The daily job checks the due party date and six preceding dates, never earlier
than the configured start date. This is seven days of bounded catch-up for
missed executions, late paperwork or daily quota limits. It reserves one daily
email slot for owner alerts and stops claiming new recipients near the runtime
limit. Pending recipients remain retryable; an interrupted claim needs manual
review. Older missed parties require explicit owner review rather than an
unlimited automatic backfill.

Run **disablePostPartyEmails** to pause the scheduler. Unsubscribe links remain
available. Neither copying source nor deploying the web app enables sending;
the owner test and explicit installer are separate steps.

## Validation

```sh
node --test tests/post-party-email.test.cjs tests/booking-pricing.test.cjs tests/booking-payments.test.cjs tests/waivers.test.cjs
```

These are mocked Google/Drive/mail tests, not live delivery tests. They cover
disabled defaults, full-address gating, owner-only actions/test mail, scheduling,
party matches and exclusions, adult deduplication, unsubscribe confirmation and
persistent suppression, uncertain sends, quota/catch-up boundaries and automatic
removal of expired promotional copy. Mobile/desktop rendering and the confirmation
form are checked separately without real attendee email.
