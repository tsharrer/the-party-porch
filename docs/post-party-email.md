# Post-party thank-you email draft

Status: email draft only. No sending or scheduling has been enabled.
Adult waiver-signer Contacts saving and a historical importer were implemented
separately and require manual deployment/run. They do not send promotional emails.
The waiver form remains unchanged, without an added email-permission checkbox.

Proposed timing: two days after the party, around 9 AM America/Chicago.
The owner selected drafting only for now.

## Email copy

**Subject:** Thanks for partying with The Party Porch!

**Preview text:** We loved being part of the fun. Plan your next party with us.

Hi there!

Thank you for joining the fun at a Party Porch party! We hope you had a great time
and made some wonderful memories.

Planning a birthday, family celebration or another get-together? We'd love to
help make your next party just as fun.

**Book your next party:** https://yourpartyporch.com/#book

Have a question? Just reply to this email.

Thanks again,
The Party Porch

Prefer not to receive party invitations from us? Reply "unsubscribe" and we'll
remove you from future promotional emails.

This is a promotional message from The Party Porch.

**Before sending:** add the business's valid physical mailing address.

## Visual design

See [the HTML preview](email-templates/post-party-thank-you.html). It uses a dark
navy Party Porch header, warm background, white message card and a gold
**Book your next party** button. The HTML is a preview/template, not a mail sender.
Do not paste raw HTML source into a normal Gmail message.

The draft avoids invented discounts, deadlines, photo links, review links or
claims about a specific party. Its opt-out button currently opens an email request;
it is not an automatic unsubscribe endpoint. Before commercial distribution,
finalize required sender/address disclosures and a functioning opt-out process.
Do not invent a business mailing address or expose a private address.

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
