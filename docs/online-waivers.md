# Online waivers

Customer link: `https://yourpartyporch.com/customer/waiver.html`

The host signs the host agreement. Each adult participant signs their own participant
form; each minor needs a participant form completed by their own parent/legal guardian.
Both forms cover parties with and without a Party Porch referee.

## One-time setup in the existing Party Porch Apps Script project

1. Sign into Apps Script as **yourpartyporch@gmail.com**. Replace **Code.gs** with
   the complete current `google-calendar.gs`, preserving any separate private
   one-time action files.
2. Add a **Script** file named **Waivers** and paste all of `waivers.gs`.
3. Add an **HTML** file named **WaiverForm** and paste all of `WaiverForm.html`.
   Do not paste the public `customer/waiver.html` into Apps Script.
4. If the manifest has explicit `oauthScopes`, preserve its existing scopes and add
   `https://www.googleapis.com/auth/drive`. The existing
   `https://www.googleapis.com/auth/script.send_mail` scope is also required.
   Do not remove the Calendar, external-request, script.scriptapp or Contacts scopes.
5. From the Apps Script editor, run **installWaiverStorage_** and approve the new
   permissions. It creates **Party Porch - Signed Waivers** in the business account's
   My Drive and logs its private URL. Re-running it reuses that folder. It does not
   email customers, send a test email, create a booking or charge a payment.
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

## Records and delivery

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

Run offline checks with:

```sh
node --test tests/booking-payments.test.cjs tests/waivers.test.cjs
```
