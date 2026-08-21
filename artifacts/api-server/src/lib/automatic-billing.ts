import { and, asc, eq, sql } from "drizzle-orm";
import { automaticInvoiceChargesTable, chargeTypesTable, consultationsTable, db, invoicesTable } from "@workspace/db";

type AutomaticChargeKind = "consultation" | "xray";

export type InvoiceLineItem = {
  chargeTypeId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  total: number;
  autoSourceKey?: string;
};

type AutomaticChargeInput = {
  kind: AutomaticChargeKind;
  consultationId: string;
  patientId: string;
  doctorId: string;
  createdById: string;
  sourceId: string;
};

const AUTO_BILLING_KEYS: Record<AutomaticChargeKind, string> = {
  consultation: "new_visit_consultation",
  xray: "xray",
};

export type AutomaticChargeResult =
  | { status: "added"; invoiceId: string; invoiceNumber: string }
  | { status: "already_billed"; invoiceId: string }
  | { status: "missing_charge"; message: string };

export function nextInvoiceNumber() {
  return sql`'INV-' || to_char(current_date, 'YYMMDD') || '-' || lpad(nextval('invoice_number_sequence')::text, 6, '0')`;
}

function sourceKey(kind: AutomaticChargeKind, sourceId: string) {
  return `automatic:${kind}:${sourceId}`;
}

export function calculateInvoiceTotals(items: InvoiceLineItem[], discount: number) {
  const subtotal = items.reduce(
    (sum, item) => sum + (item.quantity * item.unitPrice) - (item.discount ?? 0),
    0,
  );
  const tax = items.reduce((sum, item) => sum + (item.tax ?? 0), 0);
  return { subtotal, tax, total: subtotal - discount + tax };
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

class RetryAutomaticBillingError extends Error {}

async function createAutomaticInvoice(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  values: Omit<typeof invoicesTable.$inferInsert, "invoiceNumber">,
) {
  const [invoice] = await tx.insert(invoicesTable).values({
    ...values,
    invoiceNumber: nextInvoiceNumber(),
  }).returning();
  return invoice;
}

/**
 * Adds one configured charge to a consultation invoice. The source marker on
 * the invoice item makes the operation safe to repeat after retries.
 */
export async function addAutomaticCharge(input: AutomaticChargeInput): Promise<AutomaticChargeResult> {
  const marker = sourceKey(input.kind, input.sourceId);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        // Serialise automatic charging for one consultation, including different
        // charge types, before reading or changing its open invoice.
        await tx.execute(sql`SELECT id FROM ${consultationsTable} WHERE ${consultationsTable.id} = ${input.consultationId} FOR UPDATE`);

        const [previouslyBilled] = await tx.select()
          .from(automaticInvoiceChargesTable)
          .where(eq(automaticInvoiceChargesTable.sourceKey, marker));
        if (previouslyBilled) {
          return { status: "already_billed", invoiceId: previouslyBilled.invoiceId };
        }

        const [charge] = await tx.select()
          .from(chargeTypesTable)
          .where(and(
            eq(chargeTypesTable.autoBillingKey, AUTO_BILLING_KEYS[input.kind]),
            eq(chargeTypesTable.isActive, true),
          ));
        if (!charge) {
          const label = input.kind === "consultation" ? "consultation" : "X-Ray";
          return {
            status: "missing_charge",
            message: `Configure an active ${label} charge for automatic billing in Charges Master.`,
          };
        }

        // Payments and manual edits lock a specific invoice row. Lock all
        // invoices for this consultation before selecting an open one so those
        // operations cannot overwrite an automatic charge with stale totals.
        await tx.execute(sql`SELECT id FROM ${invoicesTable} WHERE ${invoicesTable.consultationId} = ${input.consultationId} FOR UPDATE`);
        const consultationInvoices = await tx.select()
          .from(invoicesTable)
          .where(eq(invoicesTable.consultationId, input.consultationId))
          .orderBy(asc(invoicesTable.createdAt));
        const visitInvoice = consultationInvoices.find((invoice) =>
          invoice.status !== "cancelled" && invoice.status !== "refunded",
        );

        const lineItem: InvoiceLineItem = {
          chargeTypeId: charge.id,
          description: charge.name,
          quantity: 1,
          unitPrice: charge.unitPrice,
          discount: 0,
          tax: charge.unitPrice * charge.taxPercent / 100,
          total: charge.unitPrice,
          autoSourceKey: marker,
        };

        if (!visitInvoice) {
          const totals = calculateInvoiceTotals([lineItem], 0);
          const invoice = await createAutomaticInvoice(tx, {
            patientId: input.patientId,
            consultationId: input.consultationId,
            doctorId: input.doctorId,
            items: [lineItem],
            ...totals,
            amountPaid: 0,
            balance: totals.total,
            status: "pending",
            notes: "Automatically generated",
            createdById: input.createdById,
          });
          await tx.insert(automaticInvoiceChargesTable).values({
            sourceKey: marker,
            invoiceId: invoice.id,
          });
          return { status: "added", invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
        }

        const items = [...((visitInvoice.items as InvoiceLineItem[]) ?? []), lineItem];
        const totals = calculateInvoiceTotals(items, visitInvoice.discount ?? 0);
        const amountPaid = visitInvoice.amountPaid ?? 0;
        const status = totals.total <= amountPaid
          ? "paid"
          : amountPaid > 0
            ? "partial"
            : "pending";
        const [invoice] = await tx.update(invoicesTable).set({
          items,
          ...totals,
          balance: Math.max(0, totals.total - amountPaid),
          status,
        }).where(eq(invoicesTable.id, visitInvoice.id)).returning();
        if (!invoice) throw new RetryAutomaticBillingError();

        await tx.insert(automaticInvoiceChargesTable).values({
          sourceKey: marker,
          invoiceId: invoice.id,
        });
        return { status: "added", invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
      });
    } catch (error) {
      if (error instanceof RetryAutomaticBillingError) continue;
      if (isUniqueViolation(error)) {
        const [previouslyBilled] = await db.select()
          .from(automaticInvoiceChargesTable)
          .where(eq(automaticInvoiceChargesTable.sourceKey, marker));
        if (previouslyBilled) {
          return { status: "already_billed", invoiceId: previouslyBilled.invoiceId };
        }
      }
      throw error;
    }
  }

  throw new Error("Automatic billing could not obtain a current invoice after retries");
}