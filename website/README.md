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
