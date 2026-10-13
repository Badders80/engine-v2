# Operations

The how-to for running v2. Settled 2026-10-13. This is the one operator guide.

It lives here until the build starts. On step 1 it moves to `engine/OPERATIONS.md` inside `Badders80/engine-v2`, whose local path is `evolution/engine_v2/website`. It does not go in the parent `evolution/engine_v2/` folder, and that folder is not made into a git repo. The website app does not get a second copy.

`OUTCOME.md` is the product law. `PLAN.md` is the build law. This file is the operating law. If this file and `OUTCOME.md` disagree, `OUTCOME.md` wins and this file is corrected. Each build step adds the click-path for the thing it just made. A procedure is not written twice.

The public host is `https://www.evolutionstables.nz`. Stripe stays in test mode until the buy path is flipped.

## Payments

The buyer pays by hosted Stripe Checkout, on the existing Evolution Stables Limited account. The website never holds a Stripe secret. The engine creates the Checkout session and returns the URL. The webhook on the engine writes the sale: stake, amount, Stripe session id, Identity id, both documents, both hashes. A card decline writes no sale and sends no founder email. Cancelling Checkout returns the buyer to the horse page and writes no sale. An our-fault failure of Checkout or the webhook sends the founder email and leaves no sale.

The first payment is the one the webhook records. Later monthly charges, failed invoices, and default handling are done by hand. "Billed monthly on the 1st" is a label on the buy screen. It is not an automated charge job.

The price is the rules module, copied from `sandbox/rebuild/src/lib/pricing.ts`. Listed price is wholesale cost times 1.05 times 1.03, rounded up to the next whole dollar. The first payment is five months: 3 months reserve plus 2 months prepaid. Refunds follow the Refund section of `OUTCOME.md`.

## Identity and private files

Signup and login are Supabase Auth, Google or email. Full name is collected at signup. The account row stores full name, email, and KYC status.

KYC is Stripe Identity on that account. It is not an NZTR membership check. A buyer who is already verified confirms their name and continues. A buyer who is not verified is sent to Stripe Identity before Checkout. A failure stops the sale, sends the buyer the KYC-failed email, and does not open Checkout.

KYC files and proof-of-address files stay in private Supabase Storage. They do not go in R2.

## Adding a horse

The only operator screen is the DSL page on the engine. Horse, trainer, and owner do not get their own screens. The engine writes those rows, and the DSL page picks them.

A registered horse starts from a loveracing.nz link: load, confirm or edit, save, then fill the three soft slots (`aboutHorse`, `racingOutlookAndPedigree`, `raceExpectation`). The race record comes from that page and is stored as one blob. An unregistered horse is typed by hand. It cannot be published past Coming Soon.

The slug is derived from the legal name when the horse is saved. A second horse that produces the same slug is refused. A rename changes the slug and the image folder. There is no redirect table. The legal-name slug is chosen before a horse is first published.

One DSL per horse per end date. Status sits on the DSL: Coming Soon, Available, Fully Allocated, Completed. Published is a separate flag. An unpublished DSL stays off the marketplace and out of the sitemap. Coming Soon is visible and cannot be bought. Available means Buy Now, and it requires a complete record and at least three images.

Prudentia, Hottathanafantasy, and First Gear stay finished static pages. They are not rows. I Stole A Manolo stays Coming Soon. Lady Ketchikan and Mulan The Brave are the two that can become Available.

The commercial terms typed on the DSL, from the owner's deal, are payment style (`subscription_float` or `upfront`), close style (`fourteen_day` or `three_x_remaining`), investor split, wholesale cost, listed stake, step size, term start, end date, and distribution schedule. The investor split must sit between 50% and 85%. 75% is what an empty form shows. It is not a horse's split. The engine calculates the retail price and the monthly amount.

## Images

Public horse images go in the new R2 bucket, in a folder named from the slug, files named `01` upward. The database stores `image_count` only. The old bucket and the old media keys are not reused. This step waits on a Cloudflare token. The landing page's own background art can stay as static files in the website app.

## Documents

The engine compiles the PDS and the SA as markdown from the horse, the trainer, and the DSL. The promoter line on every document is Alex Baddeley, Evolution Stables Ltd. The buyer accepts both in the buy flow, including the four declarations named in `PLAN.md`. The webhook stores the markdown and the hashes on the sale. A later edit to the horse does not change a document already sold.

The legal check is the principles note in the repo, cited to the September 2026 Rules of Racing PDF and the Fixed Monthly pro-forma. The Word files are not filled in.

## Emails

The engine sends four, and no others.

- Sale written: to the buyer, with the stake, the amount, and a link to MyStable.
- KYC failed: to the buyer.
- Sale succeeded: to the founder.
- Checkout or the webhook failed for a reason that is ours: to the founder.

The sender that replaces Gmail SMTP is named here when it is chosen, before the public buy path.

## Buy flow, as the buyer sees it

One surface. The same five screens on a phone and on a desktop. The layout reflows. There is no second mobile flow.

1. Terms. Stake chosen from that DSL's minimum and step.
2. Documents. PDS, then SA, both accepted.
3. Identity. Stripe Identity only if the account is not verified.
4. Pay. The browser goes to Stripe Checkout.
5. Return. MyStable. Pending until the sale row exists. The stake is not called owned before that.

## Not operated yet

These attach to the same rows later. They are not part of the first sale: a fuller investor profile, reservations, a race-by-race table, a payout engine, and automated monthly charges. Payment default, prize freeze, and forfeiture are printed procedures. A system that runs them is not part of this outcome.
