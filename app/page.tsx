import { connection } from "next/server";
import { Suspense } from "react";
import { InvoicesView } from "@/components/list/InvoicesView";
import { invoicePageSize } from "@/lib/api-types";
import { getCompany } from "@/lib/server/company-store";
import { listInvoices } from "@/lib/server/invoice-store";

export default function Home() {
  return (
    <main className="flex flex-col items-start gap-8 px-6 pt-8 pb-6 sm:px-16 sm:pb-16 lg:px-[max(8rem,calc((100vw-80rem)/2))]">
      <Suspense>
        <Invoices />
      </Suspense>
    </main>
  );
}

/** Renders the first page on the server so the table doesn't start empty; React Query takes over from there. */
async function Invoices() {
  await connection();
  const [firstPage, { company, today }] = await Promise.all([
    listInvoices({ status: null, cursor: null, limit: invoicePageSize }),
    getCompany(),
  ]);
  if (!firstPage.ok) throw new Error(firstPage.error);
  return <InvoicesView initialPage={firstPage.value} company={company} today={today} />;
}
