
# Rillet Design Challenge

This is a small accounts-receivable app where you can create invoices, save them as drafts, send them, and follow them
until they're paid or voided.

https://github.com/user-attachments/assets/2381eb40-097c-4205-97cc-b0abd3606752

**Live demo:** [rillet-pearl.vercel.app](https://rillet-pearl.vercel.app/) · **Stack:** Next.js 16, React 19, Tailwind v4, Base UI, React Query, Drizzle, Postgres
(Supabase in production)





## Run it Locally

Install the dependencies, start the dev server, and open http://localhost:3000.


```bash
npm install
npm run dev   # http://localhost:3000 — no database setup needed locally
```

## Key Design Decisions

While I made many different decisions regarding how this product should look and feel, these are the main ones I want to highlight:

### 1. Treating the invoice List as a ledger

Accounting managers use this list to match payments to what was billed, so I wanted to make sure that this list could serve as a source of truth.

When an open or overdue invoice is wrong, you void it, and the row stays with its history intact. Similarly, deleting is its own, explicit action, and it's only offered for drafts, which were never issued, and for voided invoices, which have already been cancelled.

https://github.com/user-attachments/assets/4ba2866e-537f-4eb6-a283-7096f341a605

### 2. Communicating through motion

Once you've been staring at amounts, dates, and statuses all day, one more sentence doesn't really mean much. I wanted users to really feel the weight behind their actions, as opposed to forcing them to read yet another line of text in some confirmation dialog.

That's why I decided to focus on animations, and let the invoices themselves show how state has changed. When you send an
an invoice, it lifts off the top of the screen, the way a document leaves your
desk. Saving a draft drops the invoice downward, back into the pile, and deleting cuts it into strips and lets them
fall apart. Where it goes, and how it goes, tells you whether it was delivered, filed, or destroyed.

https://github.com/user-attachments/assets/58302c68-7e2e-4fb4-8a15-c9c452c0407e


## Key Technical Decisions

Same here. Plenty of smaller choices are in the code, but these are the main desicions I want to highlight:

### 1. Storing invoices in Postgres

Financial data usually follows a well defined structure, and an invoice is no exception, so Postgres seemed like a
natural fit. The schema spells out the whole invoice, from the customer, status, and dates all the way through to the line
items and the activity log.


### 2. Making the interface feel fast

Professional software shouldn't get in the way of the work, so I made sure to reflect changes in state immediately, as opposed to waiting for long network round trips. React Query
keeps the invoices on the client, and most actions update that cache before the server
has answered, so sending, saving, voiding, and deleting change the table immediately.

Moving around the list works the same way. The first page is rendered on the server, so the table is already filled in
when the page loads. The following page is fetched in the background, which means the next page is already there
when you need it. And known customers are kept around for the form, so creating new invoices feels fast.

## What's Next

This version covers the ledger, the motion, and how the data is stored. I didn't get to the AI piece, and a few steps
after an invoice is sent are still missing. Next I'd want to add functionality to:

- Generate invoices from plain text, using an LLM.
- Send follow-ups automatically when a payment is overdue.
- Record payments, including partial ones. Paid invoices only exist in the seed data today.
- Deliver invoices as a PDF as well as an email.
