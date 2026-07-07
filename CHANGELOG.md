# Changelog — The Party Porch

All notable changes to the website, tracker, and booking backend are logged here.
Newest entries first. Dates in America/Chicago.

## 2026-07-06

### Added — party address field
- Added a required **Party address** field to the booking form (street, city, ZIP) so we
  know exactly where to deliver. Previously only a ZIP/area was collected.
- The address flows through everywhere: Formspree/mailto request, the Google Calendar
  event (now used as the event **Location** for navigation), and the confirmation email
  (shown as **Location** in the party summary). Backend `google-calendar.gs` updated
  (redeploy needed to activate on the live Apps Script).

### Changed — cart hidden behind a feature flag
- **Removed the shopping cart from the live site** (kept all code intact) until Stripe is
  set up for direct booking. Added a single `CART_ENABLED = false` flag in `index.html`;
  flip to `true` to bring everything back.
- Hidden while off: header **🛒 Cart** button, cart **drawer/scrim**, floating **cart FAB**,
  the "Build your party" **shop catalog grid**, and the booking-form **order box**.
- **Kept the "Check availability" date checker** (independent of the cart) — reworded that
  section from "add experiences to your cart" to "see if your date is open."
- Removed the **🛒 Add to cart** buttons from all 9 experience pages; the **Book/Request**
  CTAs remain and deep-link the booking form via `?exp=`.
- `?add=` deep-links are ignored while the cart is off; a stale `pp_cart` is cleared on load.

### Changed — hosting / custom domain
- **Restructured for the custom domain.** Moved the public booking site from `website/` to
  the repo **root** so `yourpartyporch.com/` serves the site (its canonical/OG tags already
  expected root). Moved the internal tracker to **`/tracker/`**.
- Added **`CNAME`** (yourpartyporch.com), **`robots.txt`** (disallows `/tracker/`), and
  **`sitemap.xml`** (home + 10 experience pages).
- Moved site docs → `docs/website-setup.md`; legacy WP embed → `docs/index-wordpress.html`.
- GitHub Pages now 301-redirects the `github.io` URL to the custom domain. **Remaining:** point
  GoDaddy DNS (A records) at GitHub Pages, then enable HTTPS. (Decision: stay code-based on a
  free static host; WordPress deemed unnecessary overhead.)

### Added
- **Tracker: much more detailed Gantt.** Rebuilt the Gantt tab into 9 swimlanes
  (Key milestones, Setup & legal, Website & tech, Product launches, Marketing & content,
  Sales/bookings, Team/hiring, Finance/reinvestment, Predicted net/mo) — 51 activity bars,
  6 milestone diamonds, and a revenue ramp across Jul '26 → Mar '28.
- **Tracker: reinvestment & kit-buying schedule.** New card tying each purchase
  (popcorn, Kit #2/#3, Booth+Backdrop, cotton candy, ads, snow cone/soft play/360, Glow
  Zone) to a **cash + demand trigger** ("buy the next kit only when current inventory is
  turning away bookings"; keep a 1-month cushion; reinvest ~30–40% of net).
- **Tracker: custom-domain task.** Added pending task `j7b` — point **yourpartyporch.com**
  to GitHub Pages (custom domain + HTTPS); site is NOT yet live on the domain.

### Added — earlier same day
- **Gantt growth-timeline tab + ROI stress-test tab.** (superseded Gantt now expanded above)

### Added — earlier same day
- **Automated customer confirmation email with deposit link.** When a booking is
  submitted, the Google Apps Script backend (`website/google-calendar.gs`) now emails
  the customer a branded "booking received" confirmation via `MailApp`, including a
  party summary (date, time, guests, add-ons, estimate) and a **$50 refundable deposit**
  call-to-action button.
  - New config vars: `BUSINESS_NAME`, `BUSINESS_EMAIL`, `BUSINESS_PHONE`,
    `DEPOSIT_AMOUNT` (50), `DEPOSIT_LINK` (paste Stripe/PayPal/Venmo/Cash App link),
    `SEND_CONFIRM_EMAIL` (master switch).
  - If `DEPOSIT_LINK` is blank, the email tells the customer a secure link will follow.
  - Helpers added: `sendConfirmationEmail`, `row`, `esc`, `prettyDate`.

### Fixed
- **Availability item parsing.** The `Items:` regex used `\s`, which matched newlines and
  bled the next `Cart:` line into the last item (e.g. `movie\ncart`). Now bounded to the
  same line, returning clean keys like `["nerf","movie"]`.

### Verified
- Live `/exec` endpoint returns valid JSONP + JSON for availability.
- Test bookings (Nerf+Movie on 2026-09-12, Photo Booth on 2026-09-20) created calendar
  events and correctly marked those items booked; a control date stayed empty.

### Backend redeploy required
Changes to `website/google-calendar.gs` only take effect after re-pasting the file into
the Apps Script editor and redeploying: **Deploy → Manage deployments → ✏️ → New version →
Deploy** (keeps the same `/exec` URL).

## Earlier this session
- Live Google Calendar availability backend + JSONP wiring (`GCAL_WEBHOOK_URL`).
- Per-item availability model (one of each item; booked items blocked per date).
- Add-to-cart shopping experience, cart drawer/FAB, "Build your party" catalog.
- Repricing to "most affordable in Houston" (stated once, in the hero).
- Setup not included (+$40 add-on); free delivery within 12 mi of ZIP 77018.
- Movie Night launched (flat $375).
