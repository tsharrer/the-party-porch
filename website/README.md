# The Party Porch — Booking Website

`index.html` is a complete, self-contained booking website (HTML + CSS + JS in one file).
Drop it into WordPress.org, any host, or open it locally in a browser.

## Before you publish — edit 1 line
Open `index.html`, find the **CONFIG** block near the bottom (in `<script>`), and set your email:

```js
var BUSINESS_EMAIL = "hello@yourpartyporch.com";  // <-- your real email
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
