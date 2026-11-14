# Party Porch owner workflow guide

Updated November 13, 2026. Practical instructions for daily operations.

## 1. Where everything lives

| Tool or document | Where to find it |
| --- | --- |
| Public website | https://yourpartyporch.com |
| Customer waiver link | https://yourpartyporch.com/customer/waiver.html |
| Customer setup/game guide | https://yourpartyporch.com/customer/nerf-party-guide.html |
| Referee training page | https://yourpartyporch.com/staff/nerf-referee-manual.html |
| Business email | Gmail, signed in as yourpartyporch@gmail.com |
| Business calendar | Google Calendar, the Party Porch calendar used by the booking backend |
| Stripe invoices/payments | https://dashboard.stripe.com |
| Twilio message logs | https://console.twilio.com |
| Apps Script projects | https://script.google.com |
| Source and Markdown records | https://github.com/tsharrer/the-party-porch/tree/main/docs |
| Local Markdown folder on this Mac | /Users/thilyesharrer/Downloads/the-party-porch/docs |
| General PDFs and document copies | Google Drive, My Drive, Documents |
| Completed signed waivers | Private Party Porch - Signed Waivers folder in the business account |

The text inbox has its own private URL. Find it in **Party Porch Text Inbox ->
Deploy -> Manage deployments -> Web app -> URL**. Use the original URL ending
in `/exec`, not the Apps Script editor URL or a redirected browser address.

Keep the private app link in a business bookmark/Home Screen shortcut. It is not
the booking/waiver deployment URL.

## 2. Quick daily checklist

1. Check Gmail for new requests, payment/automation errors and customer replies.
2. Check upcoming events in the business calendar, including pickup/cleaning.
3. Verify deposits in Stripe; an email or calendar event is not proof of payment.
4. Open the text inbox, choose the correct business number and refresh replies.
5. Before Nerf play, verify the host form and individual participant forms exist.
6. Confirm address, event time, service type, utilities and pickup/removal plan.

Owner reminders help, but do not replace reviewing the calendar and records.

## 3. Use the web text app

### Open it and find a conversation

1. Open the Party Porch Texts shortcut or the original private `/exec` URL.
2. Sign into Google in that browser as **yourpartyporch@gmail.com**.
3. Select the correct business sending number at the top.
4. Tap an existing conversation or **New conversation**.
5. Search by phone number. Search covers only loaded history; use **Load older
   messages** when an older customer is missing.

### Send a text

1. Check the recipient's US number, especially when starting a new conversation.
2. Type the message or choose **Host agreement link** / **Participant waiver link**.
3. Confirm the recipient actually agreed to business texts and has not opted out.
4. Check the consent box and tap **Send text once**.
5. Keep the page open while sending. Refresh to check the latest status.

**Queued or sent does not prove delivery.** Delivered is the carrier-reported
delivery status, not proof that the person read it.

Normal Twilio charges apply. Long messages and Unicode can use multiple segments.
Links are clickable URLs; SMS cannot hide a URL behind HTML link text.

### Receive and reply

Choose the same business number the customer texted, then tap **Refresh inbox**.
The visible app also checks about every thirty seconds. Select the conversation
and reply through the composer.

The existing inbound-email forwarding remains active. Replying to a forwarded
email does **not** send a text. The phone's native Messages app cannot send from
your Twilio number.

### If a send is unconfirmed

Do not immediately send it again. Refresh the conversation, use **Check send
status**, and inspect the matching message in Twilio logs. The message may have
been accepted even if the browser lost the response.

**Start a new draft** is a deliberate override, not an automatic retry. Use it
only after checking whether the earlier text exists. Repeated clicks or a new
draft can otherwise duplicate a message. Closing the app discards drafts; it does
not cancel a text already accepted by Twilio.

### App limits

This is a private web app, not a native App Store app. It has no offline inbox or
background push notifications. Existing MMS attachments are counted, not previewed;
check Twilio Console for them. Composition supports US SMS recipients.

## 4. Phone installation and login troubleshooting

In Safari or supported Chrome on iPhone, open the inbox and use **Share -> Add to
Home Screen**, name it **Party Porch Texts**, and tap Add. If Chrome does not show
that option, use Safari.

For Google's "Sorry, unable to open the file at this time" message:

1. Confirm the link is the private inbox's original `/exec` deployment URL.
2. Open a Safari Private tab or Chrome Incognito tab.
3. Visit https://accounts.google.com and sign into only the business account.
4. Open the inbox in that same tab.
5. If it works there, resolve Google account selection in the normal browser,
   then reopen the app there before creating the shortcut.

Being signed into Gmail's phone app is not the same as being signed into Google
in Safari/Chrome. Google documents multi-account limitations for Apps Script.

If the message instead says **Access denied**, verify the exact business account.
The app does not currently accept separate staff Google accounts.

Keep **Execute as: Me / Who has access: Only myself**. Never change it to Anyone
to fix a login issue. If the correct single-account session still fails, check
the inbox deployment settings and Apps Script Executions before editing code.

## 5. How a normal website booking works

1. The customer selects items/date, enters event/contact details and submits.
   SMS opt-in is optional; declining does not prevent booking.
2. The backend rechecks availability and creates the calendar booking/temporary
   inventory hold for a priced request.
3. One Stripe hosted deposit invoice is created. The browser and confirmation
   email use the same payment URL; consented customers can also receive it by SMS.
4. The owner/team receives request alerts. New-request details can be saved to
   Google Contacts. Neither action establishes payment.
5. The customer pays the invoice in Stripe. The five-minute reconciliation checks
   tracked invoice status. Paid reservations stay held.
6. For Nerf, the host already receives their agreement link at booking; after
   tracked deposit payment the host receives the participant link to share.
7. A four-day customer waiver reminder runs around 9 AM Houston time, catching up
   inside that window. Paid notices sent inside the window can cover the reminder.
8. Owner reminders run around 9 AM at seven days before, one day before and day-of.
9. Before the event, check payment, signed forms, delivery details and service plan.
10. Complete the party, teardown or pickup, inspect equipment and resolve any
    remaining balance according to the customer's agreement.

The deposit is 50% of the estimate under the existing rounding/minimum/maximum
rules. The deadline is **seven days from booking or event start, whichever is
sooner**. Due-date reconciliation is approximate; unpaid invoices must be voided
before inventory release. Stripe errors do not silently free the inventory.

The system does not automatically collect the remaining event-day balance or
charge a saved card for equipment damage. Handle those separately under the
agreement after checking current payment status.

Custom quotes are manual follow-up requests, not automatically priced invoices
or reserved inventory. Old/manual entries do not automatically gain seven-day
expiration just because new bookings have it.

## 6. Manual and short-notice bookings

The public item lead times remain in place. An agreed short-notice party is
handled manually rather than weakening date rules for every customer.

1. Check the business calendar, adjacent Nerf dates and existing commitments.
2. Agree on price, service, date/time, delivery location and pickup/removal.
3. Check Stripe for an existing invoice/payment before creating another.
4. Create/send the appropriate invoice manually if needed.
5. Create the booking on the actual business calendar. A Stripe invoice alone
   does not create a calendar event.
6. Send the host/participant links manually when appropriate. A cash payment,
   separate Dashboard invoice or legacy Checkout payment is not automatically
   detected unless linked to the stored booking invoice.
7. Verify the signed forms and payment before participation.

For manual Nerf reminders, put these labels on separate lines in the event
description, replacing the examples with real details privately:

```text
Items: nerf
Customer: Customer name
Email: host@example.com
Phone: 2025550110
SMS/Email consent: No
```

Change consent to Yes only when actual consent is recorded. Do not fabricate a
`Booking ID:` for a manual event. Those IDs link to private backend records.
Missing usable contacts can produce an owner alert rather than a guessed message.

Nerf availability also considers the following day for pickup/cleaning/reset.
Do not extend an `Items: nerf` event over extra dates without checking the effect:
the previous-day rule can block another day beyond the event.

## 7. Block the calendar for unavailable dates

1. Open Google Calendar in the business account.
2. Create an **all-day** event on the calendar used by Party Porch bookings.
3. Use a clear title such as **CLOSED - Party Porch unavailable**.
4. Select the first and last dates and save.
5. Refresh website availability and check that the dates are unavailable.

Recognized closure keywords are `CLOSED`, `BLOCKED`, `UNAVAILABLE` and `VACATION`.
For a multi-day block, Google Calendar's underlying end date is exclusive:
December 16-25 inclusive is start December 16, end December 26. In the normal
calendar UI, select the last included day when it presents an inclusive date range.

The December 16-25, 2026 closure was saved by the owner and read-only backend
checks confirmed all ten dates were closed.

**A closure blocks new availability; it does not cancel existing bookings, void
their invoices or notify those customers.** Review any existing commitments before
closing dates. Deleting the closure does not remove unrelated bookings.

For customer cancellation/rescheduling, separately review the calendar event,
invoice/payment, refund policy and stored hold. Editing event dates alone does not
guarantee the invoice deadline/automation metadata moved with them. Do not mark
an event cancelled and assume the financial side is complete.

## 8. Waivers and equipment responsibilities

The host completes the host/rental agreement. Each adult participant signs for
themselves; a parent/legal guardian completes a separate form for each child.
Minor forms require birth date, with age calculated on the event date.

Check **Party Porch - Signed Waivers** and matching email receipts before play.
That folder must remain private and separate from general shareable Documents.
An unsigned template or a message containing the link is not a completed waiver.

If Drive saved the PDF but email is unconfirmed, inspect Drive and Gmail first.
An uncertain email is not automatically repeated. After checking, the owner can
manually send the private PDF to the appropriate recipient.

Equipment loss/damage fees use documented reasonable repair or equivalent
replacement costs, with the stated exclusions and itemized separate invoicing.
They are not an arbitrary flat penalty and do not authorize saved-card charging.
Forms record consent/signing intent; they do not guarantee legal enforceability.

## 9. Service-day workflow

**Rental-only:** follow the booked setup arrangement; the host/designated adult
supervises play. Return everything empty, deflated, clean and completely dry,
inside its bin on the porch at the agreed pickup date/time.

**Refereed:** staff arrives sixty minutes early, handles setup, leads two hours
of games, then tears down, packs and removes equipment. The host supplies the
hose/running water and outlet. Delivery/setup alone is not referee supervision.

Use the customer guide for shared stacked water/air valve instructions and games,
and the referee manual for safety, incidents and closeout. Existing agreements
are not retroactively changed by newer policy wording.

## 10. Troubleshoot Twilio messaging

Start with the specific message rather than blindly changing settings:

1. Open https://console.twilio.com in the correct Twilio account.
2. Find **Messaging logs**; menu placement can vary. Filter by recipient, business
   sender and approximate timestamp.
3. Open the matching message. Record its SID, status and error code privately.
4. Look up the code in https://www.twilio.com/docs/api/errors and follow the
   provider's diagnosis.
5. Check balance/account status, the owned SMS-capable sender, messaging
   registration, recipient number and opt-out status as relevant.
6. Compare the app's latest refreshed history with the Console.

| Symptom | First checks |
| --- | --- |
| App cannot connect | Business Google session, internet, inbox Apps Script Executions, private Twilio properties |
| Wrong or missing line | Correct Twilio account, SMS-capable number ownership, configured TWILIO_FROM |
| Text queued/sent, not delivered | Refresh and inspect Twilio's final status/error; do not assume receipt |
| Failed/undelivered | Open that message's error code; fix the cause before a deliberate new attempt |
| Lost browser response | Check history, Check send status and Console before repeating |
| Reply missing from inbox | Selected receiving line, loaded history and Twilio inbound message log |
| Reply exists in Twilio but email missing | Gmail/spam, existing inbound webhook and public backend Executions |
| Customer did not get an automatic text | Recorded consent, eligible event/payment stage, trigger execution and Twilio logs |
| Owner did not get alert | Private OWNER_SMS_TO, sender credentials and public backend execution/logs |

Do not bypass an opt-out. Keep proof of actual consent. US local business
messaging registration and ordinary Twilio charges still apply.

There are **two Apps Script projects with separate properties**. If the Twilio
token is rotated, update the intended projects privately; changing it in one does
not update the other. Never paste credentials into code, chat or a public repo.

The inbox intentionally does not alter webhooks. Do not replace the existing
inbound-email forwarding webhook with the inbox URL. A webhook change can break
forwarding even when manual outgoing messages still work.

## 11. Troubleshoot bookings and automation

**Expired invoice:** inspect its current status in Stripe. Do not resend an old
expired Checkout link or issue a duplicate invoice without checking for payment.

**Availability error:** inspect the public backend's failed executions and Stripe
connectivity. An error is not proof a date is free. Check the calendar before a
manual promise.

**Missing waiver notice:** confirm Nerf, event/contact details, SMS consent, tracked
deposit status and that the party has not started. Untracked payments require a
manual immediate link; signed forms still need a separate check.

**Missing reminders:** open the booking project's **Triggers** and **Executions**.
Relevant handlers are `expireBookingHolds` (every five minutes),
`sendOwnerBookingReminders` (daily) and `sendCustomerWaiverReminders_` (daily).
Daily scheduling is approximate around 9 AM America/Chicago.

**Installer permission error:** preserve existing manifest scopes and approve
required permissions in the editor. Opening a scope URL does not authorize it.
Use the specific setup documentation rather than replacing the booking manifest
with the inbox's smaller manifest.

Installers are setup operations; scheduled jobs can send live messages. Do not
run reminder/payment functions merely to see what happens. `testOwnerSms` sends
a real test to configured owner/team phones but does not create a booking.

## 12. Maintain files and deployments

The repo's Markdown files are ordinary text documents ending in `.md`. Read them
on GitHub, in a text editor or as their PDF copies. The entry point is
`docs/project-record.md`; this guide is `docs/owner-workflow-guide.md`.

Useful companion records: `system-map.md`, `operations-handbook.md`,
`verification-and-open-items.md`, `online-waivers.md`, `text-inbox.md` and
`session-logs/2026-11-13.md`.

The authoritative editable Markdown lives in the repo. Drive copies/PDFs are
snapshots and must be refreshed when instructions change. Moving a PDF into
Documents does not automatically update it when the source Markdown changes.

Website updates publish through GitHub Pages from main. Apps Script code does
not auto-deploy from GitHub:

- Public booking/waiver project: preserve private settings and files; deploy a
  new version of the existing deployment, retaining its URL and required access.
- Private inbox project: update only its own files; keep Me / Only myself.
- Never paste inbox Code.gs/manifest into the public booking project.

Keep general guides in Documents; keep completed customer waivers in their
private storage folder. Review folder access before sharing guides. Never put
credentials, customer records or signed forms in GitHub.

## 13. Remaining work and verification limits

The owner reported successful inbox self-test/reply and signed-out rejection.
The last automated suite passed 76 tests. The December closure was checked live.

A complete real waiver submission with matching Drive PDF, email attachment and
signer download still needs an authorized receipt test. Earlier test-invoice
cleanup, separate private customer-invoice actions and actual scheduled
reminder/Contacts executions remain unconfirmed in the project record.

A separate referee/staff waiver is still needed if required; the training manual
does not substitute for it. Branded short payment/waiver routes have not been built.

## 14. Budget, expenses and cash tracking

In Google Drive Documents, open `Party-Porch-Budget-and-Transactions.xlsx` with
Google Sheets, then choose **File -> Save as Google Sheets**. Work in the resulting
Google Sheet rather than keeping two competing copies of the ledger.

Use Transactions for actual money received/spent, Budget for planned category
caps, Pipeline for potential bookings and Dashboard for known totals.
Enter actual billed Twilio/GitHub fees rather than guesses; missing amounts stay
flagged. Potential bookings are not cash. Record a deposit when received and the
balance only when received, using the same booking reference.

See `docs/budget-and-transactions.md` for entry rules, opening aggregate handling
and spreadsheet limits. Keep the workbook and receipts private; only the generic
instructions belong in GitHub.
