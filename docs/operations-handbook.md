# Party Porch operations handbook

Recorded November 13, 2026. Existing customer agreements must be honored or
explicitly renegotiated; later website wording does not retroactively change them.

## Rental-only versus refereed Nerf parties

| Responsibility | Rental-only | With a Party Porch referee |
| --- | --- | --- |
| Supervision | Host/designated responsible adult | Staff leads the booked games; host retains their stated agreement responsibilities |
| Setup | According to booked service | Referee arrives 60 minutes early and sets up |
| Games | Host-managed | Two-hour session led by referee |
| Closeout | Return clean, dry, empty equipment in bin on porch at agreed pickup time | Referee tears down, packs and removes equipment after games |
| Rental duration | Overnight with agreed next-day pickup | Equipment removed after the refereed session |

The host supplies a hose/running water and an electrical outlet. Delivery or
setup alone is not supervised play. This service clarification did not itself
change the existing setup/referee pricing.

Inflatables use one shared stacked dual-valve assembly for water and air. The
customer guide covers adding one gallon of water to each inflatable's water
compartment and inflating with the supplied pump. Follow the equipment-specific
instructions; do not improvise separate fill locations.

## Guides and staff training

Customer page:
https://yourpartyporch.com/customer/nerf-party-guide.html

Staff page:
https://yourpartyporch.com/staff/nerf-referee-manual.html

Printable files created in Downloads:

- `Party-Porch-Nerf-Party-Guide.pdf`: two-page box/customer guide.
- `Party-Porch-Referee-Training-Manual.pdf`: five-page staff training manual.
- `Party-Porch-Host-and-Participant-Waiver.pdf`: two-page printable forms.

The guide covers setup, safety, clean/dry/empty return and six games: Capture the
Flag, Protect the MVP, Team Elimination, Medic, Zombie Outbreak and King of the Fort.

The referee manual covers eligibility, early arrival, setup, safety briefing,
sample game timing, disputes, injuries/weather, teardown and trainer signoff.
The recorded staff requirements are at least sixteen, ability to drive and a
signed referee waiver. The separate referee/staff waiver has not yet been drafted.

These webpages are unlisted, not access-controlled. Completed forms and customer
records must never be added to them.

## Customer paperwork

Send the host the agreement at booking and the participant link to share with
guests. Each adult signs their own form and each child's parent/legal guardian
completes that child's form. A host signature is not a substitute for guest forms.

The online forms cover both refereed and non-refereed parties. They use the
approved business wording and current agreement snapshot. User approval is not
attorney/insurer approval; legal enforceability and insurance coverage are not
guaranteed by the form implementation.

Before participation, check the private completed records. A delivered link, paid
deposit, calendar entry or automated reminder does not establish that anyone signed.

The host loss/damage fee is the reasonable documented repair or equivalent
replacement cost, not an invented flat penalty. Normal wear, pre-existing damage,
equipment defects and staff-caused damage are excluded. Replace individual pieces
when available, cap repair cost at equivalent replacement and provide an itemized
explanation/quote before a separate invoice. No automatic card charge is authorized.

## Texting

Use the private inbox for outgoing messages from the business Twilio number.
Phone-native Messages cannot originate an SMS from that number. The Home Screen
icon is a web shortcut, not an App Store application.

The templates send real URLs. Ordinary SMS cannot hide a URL behind an HTML
label such as "Pay deposit." Branded short payment/form routes were discussed
but have not been implemented.

Only message customers with actual consent and never after opt-out. The inbox
checkbox is the operator's confirmation, not independent evidence of customer
opt-in. Queued/sent does not prove delivered. Refresh and inspect status/error
codes; review logs before repeating an uncertain send.

The custom inbox was chosen over a third-party subscription. Twilio usage charges
still apply. No new phone numbers or credentials were required, but existing
credentials had to be privately copied into the separate project's properties.

## Phone setup and Google login

Open the original private deployment URL ending in `/exec`, sign into the
business Google account, and use the browser's Share/Add to Home Screen flow.
Chrome and Safari were both discussed during setup.

An app login and a browser's Google session can differ. Google documents
multi-account limitations for Apps Script. If Google says it cannot open the file,
test the original deployment URL in a private/incognito tab signed into only the
business account. If that works, resolve the normal browser's account selection
before creating its Home Screen shortcut.

Do not weaken the deployment's **Only myself** restriction. The inbox currently
checks the business account, not a separate staff-account allowlist. Staff access
through their own accounts would require a deliberate access-design change.

## Calendar closures and manual bookings

Create closures on the business calendar used by the booking backend, not an
unrelated personal calendar. Use an all-day event with `CLOSED`, `BLOCKED`,
`UNAVAILABLE` or `VACATION` in its title.

For December 16-25, 2026 inclusive, use start December 16 and exclusive end
December 26. A prefilled closure draft was opened during this session and the
owner reported it saved. Its calendar selection and live availability effect
were subsequently checked through the live backend: all ten dates returned
`closed: true`.
Review existing bookings in that period separately; the closure does not cancel
them, void invoices or notify customers.

Manual invoices do not automatically create calendar bookings. Record the party
and appropriate pickup/cleaning inventory constraints separately. For manual
Nerf reminders, use the description labels in [online-waivers.md](online-waivers.md),
including actual SMS consent. Do not infer consent from a phone number.

## Snack supplies

Optional supplies are $20 per machine pack for up to 45 servings: popcorn corn/oil,
cotton-candy sugar/paper tubes or shaved-ice syrups. Customers supply shaved ice.
These packs are not automatically included in the machine rental and can only
be selected with their matching machine.
