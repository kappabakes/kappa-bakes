# Kappa Bakes — web shop

Next.js + Postgres + Stripe. Orders live in the database, and the day sheet
lives at `/admin`. No spreadsheet.

---

## How stock actually works

This is the part Google Forms couldn't do, so it's worth understanding.

1. Someone hits **Pay**. Before Stripe is even opened, the app counts real
   availability **inside a database transaction** and writes a `PENDING` order
   holding those slices for 15 minutes.
2. Two people clicking at the same instant are serialised by that transaction.
   The first gets the slices; the second is told what's actually left, on
   screen, before paying anything.
3. Stripe Checkout opens. If they pay, the **webhook** flips the order to
   `PAID` and sends the confirmations. If they wander off, the hold expires and
   the slices go back on sale on their own — nothing to sweep up.

Money is the source of truth. An order never becomes real in the browser, so
closing the tab mid-payment can't lose someone their slices, and faking the
success URL can't gain anyone any.

The tail rule from the Forms build carries over: **you can order N slices only
while at least N + 1 remain**, so the last few go out one per customer.

---

## What it costs to run

| Item | Cost |
|---|---|
| Vercel Pro | ~£16/month (Hobby forbids commercial use) |
| Postgres (Neon/Supabase free tier) | £0 at this volume |
| Resend email | £0 — free tier covers 3,000/month |
| SMS (The SMS Works) | ~5.3p per message, optional |
| Stripe | 1.5% + 20p per UK card, + VAT on the fee |

**Stripe is the real cost.** On a £6.50 slice that's about 36p once VAT on the
fee is counted — roughly 5.5%. On a £13 two-slice order it's about 4%. At 60
orders a weekend, budget roughly £1,000/year. Refunds don't return the fee, and
a chargeback is about £15.

That buys you prepayment, which ends no-shows. Worth doing the maths on how
many no-shows you actually get before committing.

---

## Setup

### 1. Database

Vercel dashboard → **Storage** → create a Postgres database, or use Supabase's
free tier. Either way you get a `DATABASE_URL`.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL first
npm run db:push           # creates the tables
```

### 2. Stripe

1. Create an account at stripe.com and complete business verification
2. **Developers → API keys** → copy the secret key (`sk_test_…` while testing)
3. **Developers → Webhooks → Add endpoint**
   - URL: `https://your-site.vercel.app/api/webhook/stripe`
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_failed`
4. Copy the signing secret (`whsec_…`)

Test locally with the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Card `4242 4242 4242 4242`, any future expiry, any CVC.

### 3. Email

Sign up at resend.com (free tier is 3,000/month). Verify `kappabakes.com`
by adding their DNS records — this is the same SPF/DKIM work as the domain
guide, and it's what keeps confirmations out of junk.

### 4. SMS (optional)

Account at thesmsworks.co.uk, register the sender ID `KappaBakes`, paste the
JWT into `SMS_API_KEY`. Leave it blank and the app just skips SMS.

### 5. Deploy

```bash
vercel
```

Add every variable from `.env.example` in **Project → Settings → Environment
Variables**, then redeploy. Set `NEXT_PUBLIC_SITE_URL` to your real URL with no
trailing slash — Stripe's redirect back depends on it.

---

## Changing things

Everything tunable is in `lib/config.ts`: flavours, prices, daily cap, max per
order, tail reserve, collection window, address. Change, commit, push — Vercel
redeploys on its own.

Adding a flavour is four lines. It appears in the menu, the pricing, and the
confirmations with nothing else to touch.

---

## The day sheet — /admin

### Signing in

Two steps: the shared password, then a six-digit code emailed to an address on
the `ADMIN_EMAILS` list. Knowing the password alone gets nobody in — they'd need
your inbox too.

The code lasts ten minutes, works once, and dies after five wrong guesses. The
session then lives in an httpOnly cookie for seven days, so the password never
appears in a URL and can't end up in a server log.

Set `SESSION_SECRET` to a long random string, or nobody can sign in:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Everything you run the weekend from:

**Slices and times.** Per-day capacity, collection start and end, open/closed,
and a note that shows on the shop. Set 24 slices for a quiet Sunday, push
collection to 3–5pm, or close a day entirely — the shop reflects it within 20
seconds. Dropping capacity below what's already sold cancels nothing; it just
stops further orders.

**Orders.** Grouped by day with a slice breakdown. Per order you can:

- Mark **Collected**, or **No-show** if they never turned up
- **Edit** name, mobile, email, collection day, and the slices themselves
- **Resend email + SMS**, either alone or as part of saving a change

Moving an order to another day checks that day has room first, so fixing a
Saturday can't quietly oversell Sunday.

Editing slices recalculates the total but **does not touch Stripe**. If the
price moves, refund or collect the difference yourself — the admin page warns
you with the exact amounts. Refunds happen in the Stripe dashboard,
deliberately: a refund button behind a single shared password is a bad idea.

---

## Order tracking — /track

Customers enter their order number **and surname**. Order numbers run KB001 to
KB999, so the number alone would be guessable — the surname stops a stranger
reading someone else's order. They see status, collection day and time, their
slices, what they paid, and a WhatsApp button pre-filled with their order
number.

---

## The no-show policy

Slices are baked to order, so payment isn't refundable if they don't collect.
It appears in four places: a tick box they must accept before paying, on the
Stripe checkout page, in the confirmation email, and on the tracking page.
The acceptance is timestamped on the order as `policyAcceptedAt`.

Wording lives in `NO_SHOW_POLICY` in `lib/config.ts`. When you change it, old
orders keep the wording they actually agreed to — the text is snapshotted onto
each order, not read live.

### The order record

Every order has an **Order record** button in the admin. It opens a plain
black-on-white document — no brand colours, everything on one page — with a
**Save as PDF or print** button. On a phone that's Share → Print → Save to
Files; on a desktop it's the print dialogue's Save as PDF.

It contains:

- Customer name, email and mobile
- Collection date, time and address
- Every slice with its toppings and price, and the total paid
- **The exact policy wording they accepted**, the timestamp, their IP address
  and device
- Stripe checkout session and payment IDs
- Whether the email and SMS confirmations were delivered
- A full append-only history: placed, paid, confirmations sent, every edit you
  made with old and new values, and when you marked it a no-show

That last part matters. An audit trail showing you didn't rewrite anything
after the fact is more persuasive than the same details with no history.

**What it's for.** Stripe disputes have an evidence section, and this covers
most of what they ask for: product description, customer communication, service
date, and your refund policy plus proof the customer saw it. Upload it as a PDF
and paste the key details into the matching fields.

**Be realistic about it.** Card networks tend to favour the cardholder,
particularly on "goods not received" for collection orders where you can't show
a delivery signature. A clear accepted policy and a clean record improve your
odds; they don't guarantee the outcome. The strongest additional evidence is
mundane: a WhatsApp thread where they confirmed the details.

Worth knowing: a customer can still raise a chargeback, and card networks
generally favour the cardholder. A clear, accepted policy is your evidence, not
a guarantee. Marking no-shows in the admin keeps that record.

---

## Photos

Drop square photos in `public/flavours/`, named to match the flavour ids:
`plain-jane.jpg`, `special-k.jpg`, `chocolate-one.jpg`, `berry-bliss.jpg`.
Around 600x600 and under 200KB each. Shoot them on the same surface in the same
light — a consistent set reads as a menu, a mixed set reads as a scrapbook.

---

## Telling people about it

A **Tell people about it** panel at the bottom of `/admin`.

The customer list builds itself: every paid order upserts a row keyed on email,
so it's a list of people rather than a list of orders, with order count, last
order date and lifetime spend.

**Segments:** everyone opted in, ordered in the last 60 days, or not ordered in
60+ days. Pick one, write a subject and message, see exactly how many people it
goes to, confirm, send. `{name}` becomes their first name. Every send is logged
so you can see what went out and to how many.

**Low stock runs itself.** A scheduled job (Thursday 5pm, in `vercel.json`)
checks the weekend and emails the list only if there's something honest to say —
slices left, day within 72 hours, and at least 60% already gone. Otherwise it
sends nothing. Change the schedule there; it needs `CRON_SECRET` set.

### The legal bit — read this before sending anything

UK PECR lets you email your **own customers** about **similar products**
without prior consent — the "soft opt-in" — provided you gave them a chance to
refuse when you took their address, and give them an easy way out every time.

The build satisfies that:

- Only people who have **actually paid for an order** ever enter the list
- The opt-in box is on the checkout page (ticked by default, which soft opt-in
  permits — it is not permitted for people who haven't bought)
- Every marketing email carries your postal address and a one-click
  unsubscribe, both legally required
- Unsubscribing is instant and no later order silently re-subscribes them
- `/privacy` explains what you keep and why

**What would break it:** emailing anyone who hasn't ordered, buying a list,
adding people who enquired but never bought, or sending something that isn't
about cheesecake. Any of those needs real prior consent, not soft opt-in.

**Marketing by SMS is not included, deliberately.** The same rules apply, but
texts are far more intrusive, cost about 5p each, and complaints there hurt
more. Keep SMS for confirmations.

---

## Test tools

Set `TEST_MODE="true"` and a panel appears at the bottom of `/admin`:

- **Create test orders** — pick a day and a number, and they land as PAID
  without touching Stripe. They count against stock like real orders, so you
  can rehearse the last-slice states, the sold-out message and the day sheet.
- **Delete all test orders** — one button, clears them out.
- Individual test orders get a **test** badge and their own Delete button.

Real orders can never be deleted here. The API refuses, because your sales
record has to stay intact.

**Set `TEST_MODE="false"` before you go live.** The whole panel and its API
disappear.

---

## Known gaps

- **Customers can't change their own order.** They message you, you edit it in
  the admin and resend. Fine at this volume.
- **Admin auth is password plus an emailed code.** Good enough for one or two
  people. Add a real identity provider before a team uses it.
- **No cut-off enforcement.** Orders are taken right up to collection day. Add
  a deadline in `upcomingDays()` when you need one.
- **Stripe and slice edits are separate.** Deliberate, but it means a price
  change is a manual refund.
