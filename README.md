# Rillet Design Challenge

This is a small accounts-receivable app where you can create invoices, save them as drafts, send them, and follow them
until they're paid or voided.

**Live demo:** [rillet-pearl.vercel.app](https://rillet-pearl.vercel.app/) · **Stack:** Next.js 16, React 19, Tailwind v4, Base UI, React Query, Drizzle, Postgres
(Supabase in production)

```bash
npm install
npm run dev   # http://localhost:3000 — no database setup needed locally
```

## Key Design decisions

While I made many different decisions regarding how this product should look and feel, these are the main ones I want to highlight:

### Treating the Invoice List as a Ledger

Bookkeeping depends on trusting the record, so every issued invoice stays in the list until someone deliberately
removes it.

When an open or overdue invoice is wrong, you void it, and the row stays with its number and its history. That's the correction an accountant already expects, since the entry
remains in the books and the cancellation sits right beside it. Similarly, deleting is its own, explicit action, and it's only offered for drafts, which were never issued, and for voided invoices, which have already been cancelled.

### Communicating Through Motion

Once you've been staring at amounts, dates, and statuses all day, one more sentence doesn't really tell you what just
happened. "Invoice sent to Acme Labs" turns into one more line to
decode, and a confirmation dialog has the same problem, because it asks you to read a paragraph and trust that the words match what the system actually did.

That's why I decided to focus on animations, and let the invoices themselves show what happened. When you send an
an invoice, it lifts off the top of the screen, the way a document leaves your
desk. Saving a draft drops the invoice downward, back into the pile, and deleting cuts it into strips and lets them
fall apart. Where it goes, and how it goes, tells you whether it was delivered, filed, or destroyed.


## Key Technical decisions

Same here. Plenty of smaller choices are in the code, but these are the main desicions I want to highlight:

### Storing invoices in Postgres

Financial data usually follows a very defined structure, and an invoice is no exception, so Postgres seemed like a
natural fit. The schema spells out the whole invoice, from the customer, status, and dates through to the line
items and the activity log.


### Making the interface feel fast

Bookkeeping is a lot of small, repeated actions, so the screen has to respond as soon as you take one. React Query
keeps the invoices on the client, and most actions update that cache before the server
has answered, so
sending, saving, voiding, and deleting change the table right away. Animations and the list never sit there waiting
on the network. If the request fails, the change rolls back, and once it finishes the app refetches so the server's version replaces what was shown.

Moving around the list works the same way. The first page is rendered on the server, so the table is already filled in
when the page loads, and changing pages keeps the current rows on screen while the next ones arrive, rather than
flashing an empty table. The following page is fetched in the background, which means Next is usually already there
when you click it. Known customers are kept around for the form, and creating an invoice bumps the next invoice number locally, so the draft after this one can show its number right away.

## What's next

This version covers the ledger, the motion, and how the data is stored. I didn't get to the AI piece, and a few steps
after an invoice is sent are still missing. Next I'd want to add functionality to:

- Generate invoices from plain text, using an LLM.
- Send follow-ups automatically when a payment is overdue.
- Record payments, including partial ones. Paid invoices only exist in the seed data today.
- Deliver invoices as a PDF as well as an email.
