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

### Click-path: adding a horse

1. Open `/dsl/new` on the engine.
2. Paste the loveracing.nz link and press Load. The page reads the link, shows the fields it found, and shows the race record it will store as one blob.
3. Correct anything the load got wrong. Sire and dam are names on the horse. The three soft slots are yours to write.
4. Save. One save writes the horse, the trainer, and the owner, and the slug comes from the legal name. You land on the read view.
5. Fill the soft slots, add the images, then open the edit page to set the commercial terms and the status. The read view is `/dsl/<id>`; the edit view is `/dsl/<id>/edit`.

An unregistered horse is typed by hand on the same page, with its sire and dam entered by hand. It saves at Coming Soon and no further. The engine refuses every status past that until the horse is registered. Branding choices on the page are shown to you and are not stored: those controls carry no field name, so nothing about them reaches the database.

## Images

Public horse images go in the R2 bucket `evolution-v2-horse-images`, in a folder named from the horse slug, files named `01` upward, with no file extension. So Lady Ketchikan's first image is the key `lady-ketchikan/01`. The database stores `image_count` and nothing else: there is no path column, no slug-to-path lookup, and no redirect table. A rename moves the folder, and nothing else has to be updated.

Three is the minimum before a DSL can be Available. More are allowed. The old bucket and the old media keys are not reused. The landing page's own background art stays as static files in the website app.

KYC files and proof-of-address files never come here. They stay in private Supabase Storage. The uploader refuses a content type that is not an image, and refuses a key under a reserved private prefix, so a passport scan or a rates bill cannot reach the public bucket by mistake.

The storage module is `engine/src/lib/storage.ts`. It reads the five `R2_*` variables from `engine/.env.local` at call time. Every one of them is required and none is defaulted: a missing value stops the upload and names what is missing, rather than publishing a dead link. The key and URL builders are pure functions; the client is built per call, so importing the module needs no credentials.

### Click-path: uploading a horse's images

1. In Cloudflare: R2 → Manage R2 API Tokens → Create API Token, permission **Object Read & Write**, scoped to `evolution-v2-horse-images`. Copy the Access Key ID and Secret Access Key into `engine/.env.local`. They are shown once.
2. In Cloudflare: R2 → `evolution-v2-horse-images` → Settings. Public access must be allowed for the r2.dev subdomain, or the images will not load on the site. Copy the public URL shown there into `R2_PUBLIC_URL`. r2.dev subdomains are per bucket, so this is the value for this bucket and not one copied from another.
3. Name the files in order on disk. `01` is the lead image, and the number you upload under is the order on the page.
4. Upload each file, one at a time, with the content type set to `image/webp`. The key carries no extension, so nothing can infer the type: without the flag the browser is handed a download instead of an image.
5. Open `{R2_PUBLIC_URL}/{slug}/01` in a browser. If it renders, the public access and the content type are both right.
6. Write `image_count` on the horse row. It is the length of the run you uploaded, and it is what the Available gate reads.

The five variables, as they appear in `engine/.env.local`:

```
R2_ACCOUNT_ID="4a90e0c2bf572bab73cb6fbb38d49577"
R2_ACCESS_KEY_ID="<Object Read & Write token>"
R2_SECRET_ACCESS_KEY="<shown once>"
R2_BUCKET_NAME="evolution-v2-horse-images"
R2_PUBLIC_URL="https://<bucket subdomain>.r2.dev"
```

Uploading three images for Lady Ketchikan, with the S3 keys exported into the shell as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`:

```bash
BUCKET="evolution-v2-horse-images"
ENDPOINT="https://4a90e0c2bf572bab73cb6fbb38d49577.r2.cloudflarestorage.com"

for n in 01 02 03; do
  aws s3api put-object \
    --bucket "$BUCKET" \
    --key "lady-ketchikan/$n" \
    --body "./lady-ketchikan/$n.webp" \
    --content-type image/webp \
    --endpoint-url "$ENDPOINT"
done
```

`wrangler r2 object put` does the same job if you are signed in to wrangler instead:

```bash
wrangler r2 object put "evolution-v2-horse-images/lady-ketchikan/01" \
  --file "./lady-ketchikan/01.webp" --content-type image/webp --remote
```

Setting the count on the horse, after the upload, and publishing the DSL:

```sql
update horses set image_count = 3 where slug = 'lady-ketchikan';

update dsls set status = 'available', published = true
where horse_id = (select id from horses where slug = 'lady-ketchikan');
```

The second statement only succeeds when the run is complete: the constraint trigger refuses `available` unless `published = true`, the split is set, the wholesale rate is above zero, the horse is `registered`, and `image_count >= 3`.

Check the run before writing the count. A folder must be `01..NN` with no gap and no repeat, because that is what `image_count` means. `imageCountFromKeys(slug, keys)` in the storage module does that check over a listing: a stray `03` with no `02` is refused rather than counted, so the row cannot drift from the bucket.

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
