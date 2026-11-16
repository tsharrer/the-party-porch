# Discount code: NERFTHANKS10

## Offer

Enter **NERFTHANKS10** in the existing booking form for 10% off rental charges.
Codes are trimmed and case-insensitive. Book by December 31, 2026, Houston time:
the server rejects new redemptions at/after January 1, 2027, 00:00 CST.
The event can occur later; normal availability/lead times still apply.

This is a reusable code, not an attendee-email allowlist or one-use coupon.
It can be shared. No review is required. The Google review request is separate
and asks for honest feedback, not a positive review.

Rental-only eligibility includes equipment and machine rental add-ons. Referees,
extra referee hours, setup labor, consumable supply packs, delivery and taxes are
not discounted. Delivery/taxes are not newly calculated by this feature; they
remain separately confirmed under the existing booking process.

Custom packages and 25+ player parties require manual quotes and cannot redeem
the automatic code in the form. Ask the owner for the applicable rental discount.

## Calculation

`booking-pricing.js` is shared between the browser and the Apps Script project.
For code bookings, the backend recalculates rental and excluded charges from
validated selections, ignoring the submitted estimate/discount amounts.
It derives the actual inventory keys and booking descriptions from those
selections as well.

For example, an 18-player rental ($250), referee ($100) and setup ($40) totals
$390 before the code. Rental savings are $25; the discounted estimated total
is $365. The existing whole-dollar 50% deposit rule yields a $183 deposit.
The deposit minimum/maximum and rounding rules are unchanged.

The estimate shows savings; the calendar description, confirmation and invoice
footer/item description record the code and savings. The actual Stripe deposit
amount is already discounted. This is not a Stripe Promotion Code and customers
should enter it on the website, not expect a Stripe coupon box.

Requests without a code preserve existing pricing and custom-quote behavior.
No existing invoice or booking is retroactively discounted. Retries reuse their
original invoice; discount expiry does not reprice an already-created booking.

## Activate in the existing booking project

1. Replace **Code.gs** with the updated `google-calendar.gs`.
2. Add a Script file named **Pricing**, then paste the entire
   `booking-pricing.js` file into **Pricing.gs**.
3. Keep Waivers, WaiverForm, existing private files, services and Script Properties.
   Do not update the separate private text-inbox project.
4. Save and deploy a **new version of the existing booking web app**, retaining
   its `/exec` URL, Me/Anyone settings and current scopes. No new scope, Stripe
   coupon, trigger or installer is needed.
5. Check the existing endpoint with `?action=promotionStatus`. It should return
   `{"ok":true,"version":"nerfthanks10-v1"}`. Use a unique query parameter if a
   browser serves a cached response.
6. Publish the matching website and `booking-pricing.js`. The form explicitly
   blocks code redemption until the deployed backend reports the matching version.
   Ordinary no-code bookings still work.
7. Check the live form's estimate. Any real invoice/booking test should use an
   explicitly authorized test and be cleaned up afterward.

Source publishing does not update Apps Script. Until the owner completes the
deployment/readiness check, the code is implemented but not activated.

Future price changes must update the shared price table as well as any existing
no-code website price tables. Keep tests comparing the offer against current
prices, especially service/supply exclusions.

## Checks

```sh
node --test tests/booking-pricing.test.cjs tests/booking-payments.test.cjs
```

Tests cover rental versus service/supply pricing, cents, all priced offerings,
invalid selections, expiration boundaries, tampered browser estimates/inventory,
invoice/confirmation savings and duplicate invoice prevention.
Browser fixtures also check readiness gating, no-code behavior, invalid/expired
codes, supply packs, custom quotes and submission details without real payments.
