# Online waivers

Customer link: `https://yourpartyporch.com/customer/waiver.html`

The host signs the host agreement. Each adult participant signs their own participant
form; each minor needs a participant form completed by their own parent/legal guardian.
Both forms cover parties with and without a Party Porch referee.
Minor forms require the child's full date of birth. Age on the event date is
calculated server-side and included with the birth date in the private record/PDF.
The existing age range of 1-17 applies to minor participants; an adult uses the adult option.

For the date-of-birth update, replace **both Waivers.gs and WaiverForm.html** in
Apps Script and deploy a new version of the existing web app. No new folder,
permissions or installer run is required. Previously signed records remain unchanged;
open forms using the earlier version must be reloaded before signing.

The host agreement also includes a **loss/damage fee** based on documented repair
or equivalent replacement costs, excluding normal wear, pre-existing damage,
equipment defects and staff-caused damage. Individual pieces are replaced when
available, charges are itemized and invoiced separately, and no automatic saved-card
charge is authorized. For this wording update (version **2026-11-13.3**), replace
**Waivers.gs** and redeploy the existing web app; the HTML form reads the terms
from that file. Previously signed records are not modified or retroactively updated.

## One-time setup in the existing Party Porch Apps Script project

1. Sign into Apps Script as **yourpartyporch@gmail.com**. Replace **Code.gs** with
   the complete current `google-calendar.gs`, preserving any separate private
   one-time action files.
2. Add a **Script** file named **Waivers** and paste all of `waivers.gs`.
3. Add an **HTML** file named **WaiverForm** and paste all of `WaiverForm.html`.
   Do not paste the public `customer/waiver.html` into Apps Script.
4. If the manifest has explicit `oauthScopes`, preserve its existing scopes and add
   `https://www.googleapis.com/auth/drive` and
   `https://www.googleapis.com/auth/userinfo.email` (for the owner-account check). The existing
   `https://www.googleapis.com/auth/script.send_mail` scope is also required.
   Do not remove the Calendar, external-request, script.scriptapp or Contacts scopes.
5. From the Apps Script editor, run **installWaiverStorage** and approve the new
   permissions. It creates **Party Porch - Signed Waivers** in the business account's
   My Drive and logs its private URL. Re-running it reuses that folder. It does not
   email customers, send a test email, create a booking or charge a payment.
   The setup function rejects anonymous visitors and accounts other than the
   business account; customer forms do not require a Google sign-in.
6. **Deploy -> Manage deployments -> Edit the existing web app -> New version -> Deploy.**
   Keep **Execute as: Me** and **Who has access: Anyone**. Retain the existing `/exec`
   URL; it is shared by bookings and waivers. Do not create a replacement URL.
7. Open the customer link. The host/participant choices appear once the deployed
   backend reports waiver setup. Check both forms from a signed-out/private browser.
   With the owner's permission, submit a clearly marked adult test form and verify
   the matching PDF and JSON record in Drive, the email attachment in the business
   inbox, and the signer download. Delete only those specific test records afterward.

The public readiness check is not a signing or email-delivery test. Until the manual
deployment and actual receipt check are completed, do not claim online collection
is live or that an owner email has arrived.

## Automatic waiver links and reminders

For **Nerf bookings**, the host agreement link is included in the initial booking
confirmation email and in the deposit text when the customer explicitly opted in
to SMS. Custom quote requests and other rentals are not sent these Nerf agreements.
This requests a host signature; it does not block payment until a signature exists.

After a tracked Stripe deposit invoice is verified **paid**, the existing five-minute
hold-check job sends the host the participant/guardian link to share with guests.
This normally occurs on the next five-minute run, not instantly at card checkout.
Email is sent where available, plus SMS only with recorded consent. It never texts
guest numbers or assumes that the host can sign for everyone.

A separate daily job runs **around 9 AM Houston time** and sends one reminder **four
days before the party**. It catches up for eligible events within the next four days,
including same-day events that have not started. If the paid message is sent inside
that window, it also serves as that channel's reminder rather than sending both.
Times are approximate; Apps Script daily triggers may run about 15 minutes either
side of the requested time.

Existing/manual Nerf events are included. For manually created events, put these
labels on separate lines in the calendar description:

```text
Items: nerf
Customer: Customer name
Email: host@example.com
Phone: 2025550110
SMS/Email consent: No
```

Only record `SMS/Email consent: Yes` when the customer has actually consented to
texts. A phone number alone is not consent. If there is no recorded consent, the
reminder uses email only. Missing usable contact information produces an owner
alert rather than guessing a destination. Do not copy real customer details into GitHub.
Manual events without a tracked hold are treated as confirmed calendar bookings;
remove cancelled events or mark their titles `CANCELLED`. Non-Nerf events, closure
entries, pickup/cleaning events, started events, released holds and unpaid tracked
bookings are excluded from participant invitations/reminders.

Automatic paid detection applies only to invoice IDs already stored with bookings
in Script Properties. A separate Dashboard invoice, cash payment or legacy Checkout
payment cannot be inferred. Those existing/manual parties still receive the scheduled
reminder when their calendar details are usable; send an immediate link manually
after an untracked payment. No new invoice or charge is created by this automation.

### Activate this automation

1. Replace **Code.gs** with the latest `google-calendar.gs`. Keep **Waivers.gs**,
   **WaiverForm.html**, Script Properties, and private one-time action files intact.
2. Save and run **installCustomerWaiverAutomations** as the business account. Keep
   the existing `script.scriptapp` and `userinfo.email` scopes; no additional scope
   is needed if waiver and booking setup is already complete.
3. This reuses/installs `expireBookingHolds` every five minutes and installs one
   daily `sendCustomerWaiverReminders_` trigger. Re-running it does not duplicate
   those jobs or change owner/team reminders. The installer itself sends nothing,
   but the next scheduled run can send live messages for existing eligible bookings.
4. Deploy a new version of the **existing** web app, retaining the `/exec` URL.
   The public `waiverStatus` response reports `notificationsReady: true` once
   this update and the installer are active.

Delivery is tracked separately per event occurrence, milestone, channel and
recipient. Already attempted messages are not automatically repeated after an
uncertain email/SMS outcome. Other channels still proceed and failures alert the
business inbox. Review that inbox and Twilio logs before manually resending.
SMS delivery still requires Twilio registration, sufficient account balance and
customer consent; normal messaging charges apply. Emails remain available if a
text fails. These are scheduled requests/reminders, not proof that any waiver was
signed; the owner must check the private completed forms before participation.

## Records and delivery

- After a completed PDF is saved, the adult signer's name and email are saved in
  business Google Contacts using the existing email-matching helper. A child's
  form saves the parent/legal guardian, not the child or emergency contact.
  Waiver contact saving does not copy phone numbers or child birth dates into
  Contacts and does not subscribe anyone to promotional email.
- The private journal records `contactStatus` as `saving`, `saved` or
  `needs_review`. Matching Contacts retain their existing names/phone numbers.
  A failed/uncertain contact write does not undo the signed PDF; it produces an
  owner alert and is not automatically repeated on the same waiver receipt.
  The signed-PDF owner email includes the contact status.
- Each form load receives a signed, random receipt token valid for 24 hours.
  Submission requires the current terms version, an adult signer, agreement consent,
  electronic-signature consent and (for minors) parent/guardian authorization.
- A private JSON journal holds the completed fields, consent/terms snapshot,
  fingerprint, original server signing time and email status. The PDF includes the
  same agreement, fields, typed signature, consent and UTC/Houston signing times.
- Drive filenames contain a random receipt and event date, not names. Neither signed
  PDFs nor JSON records are stored in GitHub or exposed through a read endpoint.
  Signers download their own PDF directly from their submission response; Drive
  sharing is not enabled. Do not share the storage folder or its records.
- An exact retry uses the original receipt, timestamp and PDF. Changed information
  under an existing receipt is rejected; contact the owner for a correction and
  complete a new form rather than editing a signed record.
- After saving the PDF, the script emails **yourpartyporch@gmail.com** with that PDF
  attached. A `sent` status means Google's mail API accepted the send, not guaranteed
  inbox delivery. Check spam or mail delivery issues separately.
- Before sending, the journal is marked `sending`. A send exception is recorded as
  `uncertain`; neither it nor `sending` is automatically retried, since the email may
  already have been delivered. The signer is told that Drive succeeded but email is
  unconfirmed. The owner can open the private PDF in Drive and manually email it
  after checking the inbox. `pending` means no send attempt has been recorded yet.
- Keep records and folder access restricted to the business account. Review retention
  and deletion obligations with qualified advice. The scope permits Drive access;
  this implementation reads/writes only the configured private waiver folder.

## Limits

Typed signatures and checkboxes record intent and time, but do **not** independently
verify identity or authority and do not guarantee legal enforceability, minor-release
validity, or insurance coverage. No attorney or insurer approval is implied.
This is not a certified identity-verification or commercial e-signature service.
Forms use server-issued tokens and a honeypot, not a CAPTCHA; anonymous Google Apps
Script access is still subject to abuse and daily Drive conversion/mail quotas.
Monitor execution failures and storage; contact customers if collection is unavailable.
Paper signing remains an alternative. The two forms are not a referee/staff waiver.

## Deploy adult signer contact saving

Replace **Waivers.gs** with the current `waivers.gs` and **WaiverForm** with the
current `WaiverForm.html` in the existing booking/waiver project, then deploy a
new version of that existing public web app, keeping its URL.
Do not change the private text inbox project.

This reuses `saveCustomerContact` from the existing `google-calendar.gs`, the
**People API v1** advanced service and the existing
`https://www.googleapis.com/auth/contacts` scope. If booking Contacts are already
installed, no new installer or scope is needed. Otherwise enable the service
and authorize the scope using the booking setup instructions.

The signed agreement version is unchanged because its terms and signature
fields are unchanged. Prior signed records are not modified in bulk. New
completed submissions, and valid retries of older receipts without a contact
status, can save their adult signer; no historical folder import is performed.

After deployment, use an authorized adult test waiver to confirm the PDF,
owner email and matching Google Contact. That live check has not been performed
by the CLI. Post-party promotional sending remains draft-only.

Run offline checks with:

```sh
node --test tests/booking-payments.test.cjs tests/waivers.test.cjs
```
