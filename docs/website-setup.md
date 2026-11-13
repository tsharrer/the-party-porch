# The Party Porch — Booking Website

`index.html` is a complete, self-contained booking website (HTML + CSS + JS in one file).
Drop it into WordPress.org, any host, or open it locally in a browser.

## Before you publish — edit 1 line
Open `index.html`, find the **CONFIG** block near the bottom (in `<script>`), and set your email:

```js
var BUSINESS_EMAIL = "yourpartyporch@gmail.com";  // your inbox
var BUSINESS_PHONE = "";                           // optional, digits only
var FORMSPREE_ID   = "";                           // optional (see below)
```

## How bookings reach you
- **Default (zero setup):** when a customer submits the form, it opens *their* email app
  pre-filled with all the party details, addressed to your `BUSINESS_EMAIL`. They hit send.
- **Automatic (recommended once live):** create a free form at [formspree.io](https://formspree.io),
  copy its form ID, and paste it into `FORMSPREE_ID`. Submissions are then emailed to you
  automatically without the customer needing to send anything.

## Using it on WordPress.org
Easiest options:
1. **Full-page HTML:** create a page, switch to the "Custom HTML" block (or a "Code/HTML"
   page template) and paste the contents of `index.html`. Or
2. **Landing-page plugin** (e.g. a blank/canvas template) and paste the HTML, or
3. Upload `index.html` via FTP/File Manager and point a page/subdomain at it.

Tip: if your WordPress theme already adds a header/footer, you can delete this file's
`<header>` and `<footer>` sections so they don't duplicate.

## SEO built in (the "killer SEO")
- Keyword-rich `<title>`, meta description, and headings targeting **"Nerf party Houston"**,
  **"mobile Nerf battle rental"**, **"Nerf war birthday party"**, plus city terms (Katy,
  Sugar Land, The Woodlands, Pearland, Cypress, Spring, Humble, Kingwood, Tomball, etc.).
- **Structured data (JSON-LD):** `LocalBusiness` (with `areaServed` + price) and `FAQPage`
  so Google can show rich results and the FAQ dropdowns in search.
- Open Graph + Twitter cards for nice link previews when shared.
- Geo meta tags for Houston, an "Areas we serve" section, and an "Perfect for" section
  (birthdays, schools/PTO, church, HOA, corporate) to capture more local searches.
- Fast, mobile-first, single-file (no external requests) = great Core Web Vitals.

### After launch, to rank faster
- Submit the site in **Google Search Console** and request indexing.
- Fill in your **Google Business Profile** once your mailed verification arrives, then embed
  reviews and keep the name/URL consistent with this site.
- Add real party **photos** with descriptive `alt` text.
- Get early **Google reviews** — they're the #1 local ranking factor.

## Take the $50 deposit with Stripe (no server needed)
1. Log in at [stripe.com](https://dashboard.stripe.com) (create the account with yourpartyporch@gmail.com).
2. **Product catalog → Payment links → New** (or **Payments → Payment Links**).
3. Add a product named **"Party deposit"**, price **$50**, one-time. Create the link.
4. Copy the link (looks like `https://buy.stripe.com/xxxxxxxx`).
5. In `index.html` (and `index-wordpress.html`) CONFIG block, set:
   `var STRIPE_DEPOSIT_URL = "https://buy.stripe.com/xxxxxxxx";`
   Now, right after a customer submits the booking form, they're taken to Stripe to
   pay the $50 deposit (their email is pre-filled). Leave it blank to skip online payment.

## Put bookings on your Google Calendar (free, no server)
See **google-calendar.gs** — paste it into [script.google.com](https://script.google.com),
deploy as a Web App (Execute as: Me · Access: Anyone), copy the `/exec` URL, and set:
`var GCAL_WEBHOOK_URL = "https://script.google.com/macros/s/AKfyc.../exec";`
Every booking then creates a calendar event and (optionally) emails the customer an invite.

## Logo & favicon
Brand assets live in `assets/` (generated from porch.png):
`logo.png` (transparent) is used in the header + hero; `favicon.ico`, `favicon-32.png`,
and `favicon-180.png` are the browser/phone icons. On WordPress, upload `logo.png` to the
Media Library and swap the logo `src`, or set it as the Site Logo/Site Icon under
**Appearance → Customize → Site Identity**.

## Add your own photos (wired & ready)
Drop these images into `website/assets/` and they'll appear automatically — no code
needed. Until you add them, each spot shows a branded color as a fallback.

| File | Where it shows | Suggested size |
|------|----------------|----------------|
| `hero.jpg` | Big hero banner behind the headline | 1600×900 |
| `exp-nerf.jpg` | "Nerf Battles" tile | 800×600 |
| `exp-snackbar.jpg` | "Snack Bar" tile | 800×600 |
| `exp-photobooth.jpg` | "Photo Booth" tile | 800×600 |
| `exp-backdrop.jpg` | "Flower Backdrop" tile | 800×600 |
| `exp-water.jpg` | "Water & Gel Battles" tile | 800×600 |
| `exp-custom.jpg` | "Custom Packages" tile | 800×600 |

Tips: use bright, landscape photos of real parties; keep them under ~400 KB each
(compress at tinypng.com). A dark gradient is layered on top so white text stays readable.
On the WordPress version the tiles load these from the GitHub-hosted `assets/` folder,
so just add the files to the repo and push.

## Experience pages & photo galleries

Every offering now has its own page in `website/experiences/` (e.g. `nerf-battles.html`,
`photo-booth.html`, `yard-games.html`). The homepage tiles link to these pages, and each
page's "Book" button deep-links back to the form pre-selected for that rental
(`index.html?exp=Nerf%20Battles#book`).

Each page shows a 4-photo gallery. Replace the placeholders by dropping real photos into
`website/assets/gallery/` using these names (4 per offering):
`nerf-battles-1..4.jpg`, `snack-bar-1..4.jpg`, `water-battles-1..4.jpg`,
`photo-booth-1..4.jpg`, `flower-backdrop-1..4.jpg`, `soft-play-1..4.jpg`,
`white-bounce-houses-1..4.jpg`, `yard-games-1..4.jpg`, `custom-packages-1..4.jpg` (≈800×600).

The booking form adapts to the selected rental: Nerf shows player count + referee,
Snack Bar prices by machine, coming-soon items show a waitlist message, and Custom
requests a quote.

## Add-to-cart shopping + real-time availability

Modeled on how the big Houston rental sites work:

- **Build your party** section (`#shop`) shows every experience as a product card
  with an **Add to cart** button. Each experience page also has an "🛒 Add to cart"
  button that deep-links back with `?add=<key>` and opens the cart.
- The **cart** lives in the browser (`localStorage` key `pp_cart`), with a slide-in
  drawer, a header button and a floating button showing the item count + subtotal.
  Cart items flow into the booking form's order box, the estimate, the emailed/Formspree
  order, and are cleared after a successful booking.
- Catalog + prices are defined once in the `CATALOG` map in `index.html` — edit prices there.

### Real-time date availability (Google Calendar)

The **Check my date** picker asks your Google Apps Script whether a date is open:

1. Deploy `google-calendar.gs` as a Web App (see the header comment in that file) and
   paste the `/exec` URL into `GCAL_WEBHOOK_URL` in `index.html` **and** `index-wordpress.html`.
2. The site calls `?action=availability&date=YYYY-MM-DD` via JSONP and marks each
   item **available** or **Booked on this date**. **Until the URL is set, it gracefully
   falls back** to "we'll confirm availability within a few hours."
3. **Inventory model: you own one of each item to start.** An item shows as
   **unavailable** on a date once it's already booked that day - every booking stores
   its item keys in the calendar event description as `Items: nerf,movie` and later
   checks read them back. Nerf is also unavailable the day after its booking for
   overnight pickup, cleaning and reset. Other items on that date stay available.
4. To take a whole day off, add an **all-day calendar event** whose title contains
   `BLOCKED`, `CLOSED`, `UNAVAILABLE` or `VACATION` — that date shows unavailable for
   everything.

### Seven-day deposit invoices and temporary holds

The booking POST creates one Stripe invoice, stores its hosted payment link, and
emails that same link to the customer. The website polls by a random booking ID;
it does not create a second payment. The deadline is the earlier of seven days from
submission or the event start, in the Apps Script project's time zone.

New calendar entries contain a `Booking ID:` linked to private Script Properties.
Pending bookings block inventory until their invoice deadline. After that deadline,
Stripe-paid invoices keep the reservation; unpaid open invoices are voided and the
hold is released. If Stripe cannot be checked, availability reports an error instead
of releasing inventory. Legacy calendar entries without a booking ID are unchanged.

Deployment order:

1. Set the Apps Script project time zone to **America/Chicago**.
2. Ensure `STRIPE_SECRET_KEY` has read/write access to **Customers, Invoices, and
   Invoice Items**. Do not paste the key into website code.
3. Paste the updated `google-calendar.gs` into Apps Script. Run
   `installBookingHoldTrigger()` once and authorize it. It installs a five-minute
   reconciliation job; Stripe invoices have due dates, but do not void themselves.
   The installer explicitly requests any missing project permissions. Approve the
   permissions requested for this project before running it again; opening a scope
   URL in a browser does not grant authorization.
   If `appsscript.json` has an explicit `oauthScopes` list, preserve its existing
   Calendar, email and external-request scopes and add
   `https://www.googleapis.com/auth/script.scriptapp`. Otherwise the installer
   cannot request permission to manage triggers.
4. Redeploy the existing web app as a **new version**, preserving the `/exec` URL.
5. Publish the matching `index.html` and `terms.html` only after the backend deploy.

Voiding and releasing overdue holds occurs on the next scheduled check (normally
within five minutes) or an availability request. A paid invoice is never automatically
voided. The integration does not automatically migrate existing Checkout sessions,
invoices or calendar entries: handle those separately after checking for payment.
Custom-quote requests are emailed for manual follow-up; they create neither a payment
invoice nor a calendar hold until pricing is agreed and an invoice is issued.
Invoice delivery uses the existing booking email (and consented Twilio SMS), not an
additional automatic Stripe invoice email. An issued invoice can also be sent from
the Stripe Dashboard.

Use `node --test tests/booking-payments.test.cjs` for offline payment-flow tests.

### Owner text alerts, reminders and Google Contacts

Accepted bookings and custom-quote requests can text the owner through the existing
Twilio sender. Owner alerts are independent of the customer's SMS consent; customer
deposit texts still require consent. These are request notifications, not proof of
deposit payment.

1. In Apps Script **Project Settings -> Script Properties**, add `OWNER_SMS_TO`
   with one or more mobile numbers separated by commas, such as
   `+12025550199,+12025550198`. Keep the primary owner's number first. Duplicate
   numbers are normalized and sent only once. Do not use the Twilio sender number
   or publish personal numbers in website code.
2. Keep the existing `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_FROM`
   properties. Set `WEBHOOK_URL` to the existing `/exec` URL so Twilio delivery
   failures can email the business inbox. Outbound messaging must be enabled for
   the Twilio sender; an accepted API request is not confirmation of delivery.
3. Paste the updated `google-calendar.gs` into **Code.gs**. Keep any separate
   private one-time action files unchanged.
4. In the editor, click **Services +**, add **People API v1** with identifier
   `People`. This enables Google's advanced People service. If the script uses a
   standard Google Cloud project, also enable the People API in that project.
5. In `appsscript.json`, preserve existing scopes and add
   `https://www.googleapis.com/auth/contacts`. The required scope list is:

   ```json
   "oauthScopes": [
     "https://www.googleapis.com/auth/calendar",
     "https://www.googleapis.com/auth/script.send_mail",
     "https://www.googleapis.com/auth/script.external_request",
     "https://www.googleapis.com/auth/script.scriptapp",
     "https://www.googleapis.com/auth/contacts"
   ]
   ```

6. Save and run `installBookingAutomations()`. Approve the new permission for the
   Party Porch account. It checks Contacts access and installs the daily reminder
   trigger once; it creates no contact, invoice or calendar booking.
7. Run `testOwnerSms()` and check each recipient's phone for its test message. This creates no
   booking or invoice. If delivery fails, check Twilio before proceeding.
8. **Deploy -> Manage deployments -> Edit -> New version -> Deploy**, keeping the
   existing web-app URL. No website frontend update is required.

Reminders run **around 9 AM America/Chicago**, seven days before, one day before,
and on the event's start date. Google time triggers are approximate (about
15 minutes either side of the requested time). They cover existing/manual events
in the configured Party Porch calendar as well as new requests awaiting payment;
they do not imply the deposit is paid. Closure/vacation entries and released holds
are excluded. Removing a calendar event stops its reminders. Recurring occurrences
are tracked separately, and reruns do not resend an already attempted milestone
to the same recipient. A send failure for one recipient does not block the others.
Only put events you want operational reminders for in this business calendar.

New requests save the customer's **name, email and phone** to Google Contacts under
the account running the script. Existing contacts are matched by exact email,
ignoring case; new phone numbers are appended without replacing saved names or
numbers. Multiple matches or an uncertain create result require manual review
instead of creating duplicates. Existing calendar bookings are not bulk-imported.
Party addresses and notes remain in the booking, not in Contacts.

SMS and Contacts failures do not undo a booking or create another invoice.
Errors are logged and emailed to the business inbox for manual follow-up.
