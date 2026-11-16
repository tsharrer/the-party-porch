# Post-party thank-you email draft

Status: email draft only. No sending or scheduling has been enabled.
Adult waiver-signer Contacts saving and a historical importer were implemented
separately and require manual deployment/run. They do not send promotional emails.
The waiver form remains unchanged, without an added email-permission checkbox.

Proposed timing: two days after the party, around 9 AM America/Chicago.
The owner selected drafting only for now.

## Email copy

**Subject:** Thanks for joining the Nerf fun!

**Preview text:** Thanks for joining the Nerf fun! Enjoy 10% off your next party rental when you book by December 31.

Hey, party crew!

Thank you for joining the Nerf fun with The Party Porch! We hope you and your
family had a blast teaming up, dodging darts and making great memories.

**Keep the good times going!**

Ready for a Nerf rematch? Whether you're planning a birthday, family celebration
or another get-together, we'd love to bring the fun to your next party.

**Book your next party:** https://yourpartyporch.com/#book

**A little thank-you: 10% off!**

Enjoy **10% off the rental price of your next party** when you book by
**December 31, 2026**. Excludes delivery, staff and taxes. Available to every
recipient of this email, whether or not you leave a review.

Enter code **NERFTHANKS10** in the booking form. Rental charges only; consumable
supply packs are not rentals and are excluded.

**Tell us how the Nerf fun went**

We'd appreciate an honest Google review. Your feedback helps other families get
to know The Party Porch. Leaving a review is completely optional and does not
affect your discount.

**Leave an honest Google review:** https://g.page/r/CauEr6BR1sANEBM/review

Have a question? Just reply to this email.

Thanks again,
The Party Porch

Prefer not to receive party invitations from us? Reply "unsubscribe" and we'll
remove you from future promotional emails.

This is a promotional message from The Party Porch.

**Before sending:** add the business's valid physical mailing address.

## Visual design

See [the HTML preview](email-templates/post-party-thank-you.html). It uses a purple
party header with gold/pink/mint accents, a lavender background, a mint invitation
card and a gold **Book your next party** button. The colorful headline reads
"Big smiles. Epic Nerf battles. Thanks for coming!" Colors use inline email-friendly
styles with no external image dependencies. The HTML is a preview/template, not a mail sender.
Do not paste raw HTML source into a normal Gmail message.

The owner approved a 10% rental-price discount for all recipients, excluding
delivery, staff and taxes, for bookings made by December 31, 2026. It is not
conditional on any review. The event itself need not occur by that date under
these stated terms. The owner supplied the Google review link.

The draft avoids unverified details such as a host name or party date. This version is specifically
for attendees of the Nerf party, not a generic all-experience mailing.
Its opt-out button currently opens an email request;
it is not an automatic unsubscribe endpoint. Before commercial distribution,
finalize required sender/address disclosures and a functioning opt-out process.
Do not invent a business mailing address or expose a private address.

The code is implemented in the booking form and shared server-side pricing.
It requires manual deployment of the updated booking backend and Pricing.gs
before customers can redeem it. The form checks promotion readiness rather
than promising a discount against an older backend. See
[discount-code setup](discount-codes.md). Do not send the offer until activation
and a live readiness check are complete.

## Requirements before enabling automation

- The owner selected an opt-out approach, not an extra waiver checkbox.
  Federal U.S. CAN-SPAM generally does not require prior opt-in, but applicable
  privacy commitments, other laws and service-provider policies must still be
  considered. Required waiver consent is not evidence of marketing opt-in.
- Save adult host, participant or guardian emails to business Contacts,
  preserving existing contact data and avoiding duplicates.
- Never collect a child's email for this follow-up or email a child directly.
- Deduplicate by party and adult email so a guardian signing for multiple
  children does not receive multiple copies.
- Define a reliable party occurrence/completion link before scheduling.
  A signed form's planned event date alone is not proof the party took place.
- Respect cancellation, corrections, opt-outs and email delivery failures.
  Do not automatically repeat an uncertain send.
- Implement and test the unsubscribe/suppression process before promotional
  automation goes live. Exclude prior opt-outs from the first message and every
  subsequent promotional send. Identify the promotion clearly, use accurate
  sender/subject information and include a valid physical postal address.
- Honor opt-outs within ten business days and keep the opt-out mechanism working
  for at least thirty days after sending. No new attendee emails are enabled yet.

Reference: [FTC CAN-SPAM compliance guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business).

The existing booking integration saves booking/request customer contacts. The
new waiver update saves adult signer names/emails after completed submissions
when deployed. The owner-only `importWaiverSignerContacts` action can import
existing completed forms without asking attendees to submit again. Neither
action sends this post-party email. A tested suppression process remains part
of the future sending design; Contacts membership is not an opt-in record.
