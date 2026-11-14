# Party Porch project record

Recorded November 13, 2026, America/Chicago.

This is the entry point for the work completed during this conversation.
It combines repository evidence, prior session checkpoints and owner-reported
installation results. Historical features are identified separately from current
behavior. It contains no credentials, customer records or signed forms.

## Records

| Document | Purpose |
| --- | --- |
| [Owner workflow guide](owner-workflow-guide.md) | Daily instructions: text app, bookings, waivers, calendar blocks and troubleshooting |
| [Budget and transaction workbook](budget-and-transactions.md) | Private Google Sheets import, expense entry, budgeting and pipeline rules |
| [Post-party email draft](post-party-email.md) | Thank-you copy and visual preview; not scheduled or enabled |
| [Session work log](session-logs/2026-11-13.md) | Changes, decisions, deployment history and supporting commits |
| [System map](system-map.md) | Website, booking/payment backend, waivers and private inbox |
| [Operations handbook](operations-handbook.md) | Rentals, referees, customer communications and calendar closures |
| [Verification and open items](verification-and-open-items.md) | Tested versus owner-reported outcomes and outstanding checks |
| [Online waiver setup](online-waivers.md) | Signing, private storage and automated waiver requests |
| [Private text inbox setup](text-inbox.md) | Separate-project installation, private access and phone shortcut |
| [Website setup](website-setup.md) | Existing integration and deployment instructions |
| [Changelog](../CHANGELOG.md) | Repository-wide change history |

Some older setup instructions describe superseded fixed deposits, Checkout links,
required SMS consent, coming-soon products or the standalone availability checker.
Use this record and the feature-specific current instructions for present behavior.
Historical prices and promotional claims are not a current price list.

## Current system

The public website is https://yourpartyporch.com, served from the repository root
through GitHub Pages. Website changes on `main` publish automatically. Google Apps
Script changes must be saved and manually deployed separately.

The existing public Apps Script project handles availability, bookings, Stripe
deposit invoices, confirmation messages, owner notifications, Google Contacts and
customer waivers. It runs as the business account with public web access for
customer forms. Signed records are stored privately, not in GitHub.

The text inbox is a separate owner-only Apps Script project. It uses the existing
Twilio account and business numbers, but its Script Properties must be configured
separately. It must remain deployed as **Me / Only myself**.

## Latest recorded status

- Inbox source was pushed as `6ae0a50`. The owner subsequently reported successful
  installation, a real self-test SMS/reply and signed-out access rejection.
- Mobile account-routing problems were resolved without changing access controls.
  Safari setup on a second phone was discussed; Home Screen installation is a
  device step, not a new native application.
- The latest automated run passed 76 booking, waiver and inbox tests. Local
  mobile/desktop inbox checks passed without sending real SMS.
- Live waiver readiness previously reported version `2026-11-13.3` and enabled
  notifications. A complete real signing-to-Drive-to-email receipt test remains
  independently unverified.
- A calendar closure for December 16-25, 2026 was opened at the owner's
  request; the owner subsequently reported it saved. Read-only live availability
  checks confirmed `closed: true` for all ten dates.

See [verification and open items](verification-and-open-items.md) before treating
an installation report, draft, API acceptance or readiness check as proof of
end-to-end delivery.
