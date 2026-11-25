# Visitor tracking and retargeting

The website can tell Meta, LinkedIn and Google that someone visited, so those platforms can show our ads to that
audience later. It is **off** until you fill in IDs, and even then a tag runs only for visitors who press **Accept**
on the cookie notice. **Decline**, or a browser sending Global Privacy Control, keeps every tag off. A **Cookie
settings** link in the footer lets people change their mind.

These tags do not tell us who a visitor is by name. They build audiences inside Meta, LinkedIn and Google. Each
platform needs enough visitors in an audience before it will show ads to it.

## 1. Get the IDs (you do this; each needs your own login)

| Tag | Where to get the ID | What it looks like |
| --- | --- | --- |
| Meta Pixel | [Events Manager](https://business.facebook.com/events_manager2/) → **Connect data sources** → **Web** → **Meta Pixel**. The ID is under the pixel's name. | 15–16 digits |
| LinkedIn Insight Tag | [Campaign Manager](https://www.linkedin.com/campaignmanager/) (needs a LinkedIn ad account) → **Analyze** → **Insight Tag** → **Install my Insight Tag**. The ID is the `_linkedin_partner_id` number in the snippet. | 6–7 digits |
| Google tag | [Google Analytics admin](https://analytics.google.com/analytics/web/#/admin) → **Data streams** → your web stream → **Measurement ID**. For Google Ads audiences, also link the Ads account there. | `G-XXXXXXXXXX` |

You can start with just one platform. Leave the others as empty quotes.

## 2. Put them in the site

Open `assets/consent.js` and paste each ID between the quotes in `IDS`, then deploy the site. Do not paste the
tag snippets the platforms show you. The consent script already contains the safe version of them.

## 3. Check it

1. Open the site in a private window. The cookie notice should appear and no ad requests should be made yet.
2. Press **Accept**. In your platform's tester (Meta Pixel Helper, LinkedIn Insight Tag helper, Google Tag Assistant) you should see the page view.
3. Open the footer's **Cookie settings** and press **Decline**. The page reloads and the tags stay off.

## Notes

- `The tags record page views on the public pages only (home, experiences, city pages, terms, privacy). The waiver forms, the staff tools and the email templates never load them, because they handle signatures and customer details.
- Page views are the only event for now. A "booking request sent" event could be added to the booking form later.
- This site is hosted on GitHub Pages, so it has no security-header file to change.`
- Privacy page: updated to describe these cookies. Please read it once; it is plain-language text, not legal advice.
- Cloudflare bot protection and any firewall rules were not touched. Nothing here changes who can reach the site.
