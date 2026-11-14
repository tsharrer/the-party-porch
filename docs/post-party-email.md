# Post-party thank-you email draft

Status: email draft only. No sending or scheduling has been enabled.
Adult waiver-signer Contacts saving was implemented separately and requires
manual deployment; it does not enroll those contacts in promotional emails.

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

## Visual design

See [the HTML preview](email-templates/post-party-thank-you.html). It uses a dark
navy Party Porch header, warm background, white message card and a gold
**Book your next party** button. The HTML is a preview/template, not a mail sender.
Do not paste raw HTML source into a normal Gmail message.

The draft avoids invented discounts, deadlines, photo links, review links or
claims about a specific party. Before commercial distribution, finalize required
sender/address disclosures and a functioning opt-out process. Do not invent a
business mailing address or expose a private address.

## Requirements before enabling automation

- Collect a separate optional permission for promotional follow-up email.
  Required waiver/e-signature consent is not permission to market.
- Save the consenting adult host, participant or guardian's email to business
  Contacts, preserving existing contact data and avoiding duplicates.
- Never collect a child's email for this follow-up or email a child directly.
- Deduplicate by party and adult email so a guardian signing for multiple
  children does not receive multiple copies.
- Define a reliable party occurrence/completion link before scheduling.
  A signed form's planned event date alone is not proof the party took place.
- Respect cancellation, corrections, opt-outs and email delivery failures.
  Do not automatically repeat an uncertain send.
- Implement and test the unsubscribe/suppression process before promotional
  automation goes live. Contacts membership alone is not permission to send.

The existing booking integration saves booking/request customer contacts. The
new waiver update saves adult signer names/emails after completed submissions
when deployed. It does not send this post-party email or bulk-import old forms.
An opt-out button and suppression process remain part of the future sending
design; an opt-out option is not evidence that a signer opted into marketing.
