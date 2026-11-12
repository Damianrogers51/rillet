import data from "@/data/invoices.json";
import dummyData from "@/data/dummy-invoices.json";
import type { Company, Invoice } from "@/lib/invoices";

type InvoicesData = {
  company: Company;
  currentDate: string;
  invoices: Invoice[];
};

const { company, currentDate, invoices: realInvoices } = data as InvoicesData;
const dummyInvoices = (dummyData as { invoices: Invoice[] }).invoices;

const invoices = [...realInvoices, ...dummyInvoices].sort(
  (a, b) => b.issueDate.localeCompare(a.issueDate) || b.invoiceNumber.localeCompare(a.invoiceNumber),
);

export { company, currentDate, invoices };
