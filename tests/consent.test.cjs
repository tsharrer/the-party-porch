const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const htmlFiles = (dir) => fs.readdirSync(path.join(root, dir)).filter((name) => name.endsWith(".html")).map((name) => path.posix.join(dir, name));

const marketing = ["index.html", "terms.html", "privacy.html", ...htmlFiles("experiences"), ...htmlFiles("areas")];
const private_ = [...htmlFiles("customer"), ...htmlFiles("staff"), ...htmlFiles("staff/text-inbox"), "WaiverForm.html", "PostPartyEmail.html"];

test("the consent script ships with every IDs empty, so tracking stays off until the owner adds them", () => {
  const source = read("assets/consent.js");
  assert.match(source, /metaPixelId: ""/);
  assert.match(source, /linkedinPartnerId: ""/);
  assert.match(source, /googleTagId: ""/);
  new Function(source); // parses
});

test("every public marketing page loads the consent script and has a Cookie settings link", () => {
  for (const file of marketing) {
    const html = read(file);
    assert.ok(html.includes('<script src="/assets/consent.js" defer></script>'), `${file} loads consent.js`);
    assert.ok(html.includes("data-cookie-settings"), `${file} has a Cookie settings link`);
  }
});

test("waiver, staff and email-template pages never load the tags", () => {
  for (const file of private_) {
    assert.ok(!read(file).includes("consent.js"), `${file} must not load consent.js`);
  }
});

test("the script loads nothing before consent and honors Global Privacy Control", () => {
  const source = read("assets/consent.js");
  assert.match(source, /globalPrivacyControl === true/);
  // Tag loaders are only reachable from loadTags(), which runs after Accept or a remembered Accept.
  const outside = source.replace(/function loadTags\(\) \{[\s\S]*?\n  \}\n/, "");
  assert.ok(!/connect\.facebook\.net|snap\.licdn\.com|googletagmanager\.com/.test(outside), "ad hosts appear only inside loadTags");
});

test("the privacy policy explains the cookies and how to opt out", () => {
  const html = read("privacy.html");
  assert.match(html, /Advertising and analytics cookies/);
  assert.match(html, /off by default/);
  assert.match(html, /Global Privacy Control/);
});
