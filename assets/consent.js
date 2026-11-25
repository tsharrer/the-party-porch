// Cookie choices and marketing tags for yourpartyporch.com.
// (Kept in step with the Better Monday site; pages that collect waivers or run the staff tools never load it.)
//
// Nothing here loads, sets a cookie or contacts Meta, LinkedIn or Google until a visitor presses
// "Accept". With no IDs filled in below, this file does nothing at all: no banner, no tags.
// Visitors whose browser sends Global Privacy Control are treated as having declined.
//
// To switch tracking on, paste the IDs below (see docs/tracking-setup.md), then deploy.
(() => {
  "use strict";

  const IDS = {
    metaPixelId: "",        // Meta Pixel ID, digits only, e.g. "123456789012345"
    linkedinPartnerId: "",  // LinkedIn Insight Tag partner ID, digits only
    googleTagId: "",        // Google tag ID: "G-XXXXXXXXXX" (Analytics) or "AW-XXXXXXXXX" (Ads)
  };
  // Tests (and only tests) set window.SITE_TRACKING before this file runs.
  const ids = Object.assign({}, IDS, window.SITE_TRACKING || {});
  const valid = {
    metaPixelId: /^\d{8,20}$/.test(ids.metaPixelId),
    linkedinPartnerId: /^\d{4,12}$/.test(ids.linkedinPartnerId),
    googleTagId: /^(G|AW|GT)-[A-Z0-9]{6,14}$/.test(ids.googleTagId),
  };
  if (!valid.metaPixelId && !valid.linkedinPartnerId && !valid.googleTagId) return;

  const STORAGE_KEY = "pp-cookie-choice-v1";
  const MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

  const readChoice = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved && (saved.choice === "accepted" || saved.choice === "declined") && Date.now() - saved.at < MAX_AGE_MS) return saved.choice;
    } catch (error) { /* storage blocked: treat as no choice yet */ }
    return null;
  };
  const writeChoice = (choice) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, at: Date.now() })); } catch (error) { /* ignore */ }
  };

  let tagsLoaded = false;
  const addScript = (src) => {
    const script = document.createElement("script");
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  };

  function loadTags() {
    if (tagsLoaded) return;
    tagsLoaded = true;

    if (valid.metaPixelId) {
      const fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
      if (!window.fbq) { window.fbq = fbq; window._fbq = fbq; fbq.push = fbq; fbq.loaded = true; fbq.version = "2.0"; fbq.queue = []; }
      addScript("https://connect.facebook.net/en_US/fbevents.js");
      window.fbq("init", ids.metaPixelId);
      window.fbq("track", "PageView");
    }

    if (valid.linkedinPartnerId) {
      window._linkedin_data_partner_ids = (window._linkedin_data_partner_ids || []).concat(ids.linkedinPartnerId);
      if (!window.lintrk) {
        window.lintrk = function (a, b) { window.lintrk.q.push([a, b]); };
        window.lintrk.q = [];
      }
      addScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
    }

    if (valid.googleTagId) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag("js", new Date());
      window.gtag("config", ids.googleTagId);
      addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(ids.googleTagId));
    }
  }

  // Declining after accepting: remove the cookies the tags left on this site, then reload so no tag runs.
  function clearTrackingCookies() {
    const hosts = [location.hostname, "." + location.hostname.replace(/^www\./, "")];
    for (const cookie of document.cookie.split(";")) {
      const name = cookie.split("=")[0].trim();
      if (/^(_fbp|_fbc|_ga|_gid|_gat|_gcl_|_gac_|li_|lidc|bcookie|bscookie|UserMatchHistory|AnalyticsSyncHistory)/.test(name)) {
        for (const domain of hosts) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain}`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  }

  const css = `
.cookie-banner{position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;max-width:640px;margin-inline:auto;padding:1.1rem 1.25rem;background:#fff;color:#2A2036;border:1px solid #F0E9E2;border-radius:16px;box-shadow:0 12px 40px rgba(22,32,46,.22);font:400 .9rem/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif}
.cookie-banner p{margin:0 0 .85rem}
.cookie-banner a{color:#B3262B}
.cookie-banner .cookie-actions{display:flex;flex-wrap:wrap;gap:.6rem}
.cookie-banner button{flex:1 1 9rem;min-height:44px;padding:.6rem 1.2rem;border-radius:999px;border:1px solid #B3262B;background:#fff;color:#8F1D21;font:600 .9rem -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;cursor:pointer}
.cookie-banner button:hover{background:#FFF1F1}
.cookie-banner button:focus-visible{outline:3px solid #FF5A5F;outline-offset:2px}`;

  function showBanner() {
    if (document.querySelector(".cookie-banner")) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);

    const banner = document.createElement("div");
    banner.className = "cookie-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Cookie choices");
    banner.innerHTML = '<p>We\'d like to use cookies from Meta, LinkedIn and Google to see how people find our site and to show our party ideas to people who have visited. Nothing loads unless you accept. <a href="/privacy.html">Read how we use them</a>.</p>' +
      '<div class="cookie-actions"><button type="button" data-choice="declined">Decline</button><button type="button" data-choice="accepted">Accept</button></div>';
    banner.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-choice]");
      if (!button) return;
      choose(button.dataset.choice);
      banner.remove();
    });
    document.body.appendChild(banner);
  }

  function choose(choice) {
    const before = readChoice();
    writeChoice(choice);
    if (choice === "accepted") loadTags();
    else if (before === "accepted" || tagsLoaded) { clearTrackingCookies(); location.reload(); }
  }

  const gpc = navigator.globalPrivacyControl === true;

  function init() {
    // "Cookie settings" links in page footers stay hidden until tracking is configured.
    document.querySelectorAll("[data-cookie-settings]").forEach((link) => {
      link.hidden = false;
      link.addEventListener("click", (event) => { event.preventDefault(); showBanner(); });
    });
    const saved = readChoice();
    if (saved === "accepted") loadTags();
    else if (saved === null) {
      if (gpc) writeChoice("declined");
      else showBanner();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
