# Private Party Porch Text Inbox

This is a **separate** Apps Script project, accessible only to
**yourpartyporch@gmail.com**. The repository contains source code, not conversations,
Twilio credentials or a public messaging endpoint. Do not install these files in
the public booking/waiver project. Do not publish a public inbox or deploy as Anyone.

## Install

1. Sign into [Apps Script](https://script.google.com) as the business account.
   Click **New project** and name it **Party Porch Text Inbox**.
2. Replace the new project's **Code.gs** with `staff/text-inbox/Code.gs`.
3. Add an **HTML** file named **Index** and paste `staff/text-inbox/Index.html`.
4. In **Project Settings**, enable the manifest in the editor. Replace this NEW
   project's `appsscript.json` with `staff/text-inbox/appsscript.json`.
   Do not replace the booking project's manifest.
5. Add these private **Script Properties** in the new project, copying the values
   from your existing private Twilio settings: `TWILIO_ACCOUNT_SID`,
   `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`. Use the actual `+1` business number,
   not a personal caller ID. Never paste credentials into code, chat or GitHub.
6. Save and run **initializeTextInbox** from the editor. Authorize access.
   It verifies the Twilio account and sender and initializes the private send-token
   secret. It sends **no SMS**, buys no numbers and changes no webhooks.
7. **Deploy -> New deployment -> Web app**. Select **Execute as: Me** and
   **Who has access: Only myself**. Deploy and copy this new app's `/exec` URL.
   Never replace the booking app's URL with it.
8. Open that URL in Safari signed into the business Google account. Use
   **Share -> Add to Home Screen** and name it **Party Porch Texts**.
   This is a web shortcut, not an App Store app or offline application.
9. Confirm a signed-out/private browser cannot open the inbox. With your explicit
   permission, send one clearly labeled test to your own consenting phone, check
   receipt, reply from that phone, and Refresh to verify the incoming message.

The source/backend/UI are tested locally, but installation, Google login and actual
SMS delivery must be verified in your account. A deploy URL and credentials are
not available to the CLI, so it cannot silently deploy or send this test.

## Using the inbox

Choose your business sending number, open a loaded conversation or select **New
conversation**, enter a US recipient, and compose a message. There are quick buttons
for the host agreement and participant/guardian waiver link. Confirm actual customer
SMS consent, then click **Send text**. Never send after a customer opts out.

Messages show Twilio statuses: **queued/sent is not delivered**. Delivery failures
and error codes appear in history. The app refreshes about every 30 seconds while
visible; **Refresh inbox** checks immediately. It reads recent account history and
filters by the selected number. Use **Load older messages** for earlier pages.
Search applies only to loaded history. Different number selections have separate
conversation views; no personal-number impersonation or unowned sender is allowed.

Only SMS text sending is supported. Existing MMS attachments are counted but not
downloaded or previewed; use Twilio Console for those. Redacted/unavailable text is
identified, not reconstructed. The app does not bypass Twilio retention policies.
There is no background push notification or offline inbox; existing inbound email
forwarding continues because the app does not alter your Twilio webhooks.

## Duplicate-send and privacy safeguards

- Every read/send/configuration RPC checks the active Google account. Deployment
  restriction is an additional gate, not the only protection.
- Credentials stay server-side in this separate project's private Script Properties.
  No conversation, draft, phone number or message text is written to browser storage.
  Closing/reloading discards unsent drafts and loaded history.
- A server-signed send token expires after 24 hours. The server records a private
  fingerprint/receipt before sending and rejects changed details under that token.
  The receipt stores no message body, phone number or Twilio authentication secret.
  Receipts are cleaned after eight days, after replay tokens have expired.
- Repeating the same send cannot create another text after an accepted or uncertain
  outcome. A timeout is **not** reported as successful. Check the conversation,
  **Check send status**, and Twilio logs before explicitly starting another draft.
  If the API accepted a message but returned no usable receipt, the app cannot
  guarantee whether it was sent and does not automatically resend.
- Ordinary message bodies and URLs render as text/safe links, not executable HTML.
  Paging tokens are URL-encoded and used only on fixed Twilio message/number routes.
- The consent checkbox records the operator's confirmation, not independent proof
  of customer opt-in. Keep your consent records and respect Twilio opt-outs,
  A2P 10DLC registration and messaging policies. Normal SMS/multipart charges apply.
- History reads and polling use Apps Script/Twilio API quotas. Check both services'
  errors if the app becomes unavailable. Keep the original Console as a fallback.

Run `node --test tests/text-inbox.test.cjs` for the focused offline backend checks.
These cover owner-only entry points, sender ownership, pagination, consent/input
validation, send replay, provider/network failures, delivery checks and receipt
cleanup. Local mobile/desktop browser checks also verified safe message rendering,
waiver templates, number switching during refresh, exhausted history, interrupted
send recovery and draft-token races. No real SMS was sent during these checks.
