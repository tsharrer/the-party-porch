# Verification and open items

Updated November 16, 2026. This separates automated checks, historical live
checks, owner reports and unresolved work. It does not assert a new live audit.

## Verification evidence

| Area | Evidence | Limitation |
| --- | --- | --- |
| Website/photos/guides | Historical published-page and responsive checks | Not every public page was rechecked when writing this document |
| Booking/payment flow | Offline tests plus one owner-authorized live invoice/hold test | No test card payment was made; live test cleanup is unconfirmed |
| Owner SMS | Owner reported receipt of configured test messages | Scheduled reminders/Contacts not independently verified end to end |
| Online waiver forms | Signed-out rendering, readiness and private-storage/email mocks | Real signed submission, Drive PDF and matching email attachment still need a receipt check |
| Waiver version | Historical live readiness showed `2026-11-13.3`, notifications enabled | Readiness does not prove a signed form or delivered reminder |
| Private inbox backend | Fifteen offline tests | Mocked Twilio/Google services |
| Private inbox UI | Local mobile/desktop Chrome browser checks | Not a live Google login or carrier-delivery test |
| Private inbox installation | Owner reported own-phone SMS arrival, reply in inbox and signed-out rejection | Owner-reported; assistant did not access the private deployment |
| Second-phone access | Owner acknowledged Safari login guidance positively | Separate send/reply test and Home Screen persistence not independently verified |
| December closure | Owner reported saving; live availability returned `closed: true` for all ten dates | Existing customer commitments still require separate review |
| Owner workflow guide | Markdown and printable PDF generated; content/layout checked and copied into Drive Documents | Drive copies are snapshots, not automatic repo updates |
| Private budget workbook | Tabs, formulas, seed classification and file copies checked | Excel upload must be saved as Google Sheets; native Sheets calculation/import not yet verified |
| Adult waiver signer Contacts | Ten focused cases plus booking/signing regressions; 71 targeted tests passed | Manual deployment/import and real Contact receipt check still required; historical import not yet run |
| NERFTHANKS10 rental discount | 49 focused pricing/payment tests plus mocked mobile/desktop form checks; live readiness confirmed `nerfthanks10-v1` after owner deployment | No real discounted invoice/payment was created |
| Automatic post-party emails | 15 focused automation tests; 93 tests with dependent regressions; live route confirmed `post-party-v1`; owner reported accepted matched preview, owner email/link checks, installation and completed manual send action | No execution summary or independent attendee delivery count; future scheduled execution remains unverified |

A historical combined automated run passed 76 tests:

```sh
node --test tests/booking-payments.test.cjs tests/waivers.test.cjs tests/text-inbox.test.cjs
```

Inbox browser checks exercised connection recovery, mobile/desktop layout, safe
text/link rendering, number selection, waiver templates, consent, accepted and
rejected sends, lost-response recovery, history exhaustion, stale reads, token
races and absence of browser conversation storage. These checks sent no real SMS.

## Outstanding checks

On November 18, the owner requested less-frequent hold reconciliation after
intermittent Google server errors despite successful runs. The updated installer
now sets every eight hours and replaces old hold-check timers, matching the owner's
reported manual eight-hour schedule. The initial proposed interval was 12 hours;
the owner chose eight. Payment/trigger tests cover replacement and preservation of
other jobs. The live schedule and resolution of the underlying errors are not
independently verified.

The discount backend is activated. The owner reported completing email setup,
private full address/URL configuration, matched-recipient preview approval,
owner-test receipt/link checks, scheduler installation and the manual due-party
send action. Do not infer attendee delivery from that report. Check the execution
summary and future scheduled runs without repeating uncertain sends.
See [email setup](post-party-email-automation.md) for safe review/pause procedures.

1. Review existing commitments inside the verified December 16-25 closure.
   Blocking new availability does not cancel or renegotiate those bookings.
2. With explicit authorization, complete a clearly labeled adult waiver test.
   Verify the PDF and JSON journal in the private folder, the owner email
   attachment and signer download. Clean up only the specific test artifacts.
3. Confirm cleanup of the earlier authorized live deposit test: void any unpaid
   test invoice and remove only its identified test calendar entries.
4. Confirm whether the private one-time replacement-invoice action was run.
   Inspect current payment/invoice status before doing anything financial or
   resending; no customer-specific action is recorded as completed here.
5. Verify actual scheduled owner/customer reminders and Google Contacts behavior
   in the business account without inventing sends or bulk imports.
6. Draft a separate referee/staff waiver if required. The host/participant forms
   and staff manual do not substitute for it.

## Known limits and deliberate non-features

- Shortened branded waiver/payment routes were not implemented.
- Signing is not a prerequisite enforced by booking/payment submission.
- Untracked cash, Dashboard invoices and legacy Checkout payments do not trigger
  automatic paid-invoice detection. Manual calendar reminders can still apply.
- The inbox has no background push, offline mode, outgoing MMS or media previews.
- No third-party texting inbox was connected and no webhook was changed by the
  private inbox implementation.
- Customer guide and referee manual pages are unlisted, not private.
- User approval does not establish legal review, enforceability or insurance.
- Existing agreements are not retroactively changed by newer service policies
  or waiver versions.

## Safety when finishing checks

Never publish credentials, customer records, signed PDFs or private action scripts.
Never assume that a draft opened in the browser was saved or sent.
Never treat an API-accepted email/SMS as guaranteed inbox/phone delivery.
Do not automatically repeat an uncertain send or create a replacement invoice
without first checking whether the original operation succeeded.
