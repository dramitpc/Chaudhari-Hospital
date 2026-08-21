import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";

const schema = `automatic_billing_test_${randomUUID().replaceAll("-", "")}`;
process.env.DATABASE_SCHEMA = schema;

const {
  automaticInvoiceChargesTable,
  chargeTypesTable,
  db,
  invoicesTable,
  patientsTable,
  pool,
  queueTokensTable,
  usersTable,
} = await import("@workspace/db");
const { addAutomaticCharge } = await import("./lib/automatic-billing");
const { createJWT } = await import("./lib/auth");
const { default: app } = await import("./app");

const tablesToClone = [
  "users",
  "patients",
  "queue_tokens",
  "consultations",
  "charge_types",
  "invoices",
  "invoice_payments",
  "automatic_invoice_charges",
  "investigations",
  "audit_logs",
];

let baseUrl = "";
let authToken = "";
let testUserId = "";
let server: ReturnType<typeof app.listen>;

type ApiResult = {
  response: Response;
  body: Record<string, unknown> | null;
};

async function request(path: string, init: RequestInit = {}): Promise<ApiResult> {
  const response = await fetch(`${baseUrl}/api${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) as Record<string, unknown> : null,
  };
}

async function invoiceForConsultation(consultationId: string) {
  const invoices = await db.select().from(invoicesTable);
  const invoice = invoices.find((candidate) => candidate.consultationId === consultationId);
  assert.ok(invoice, "expected an invoice for the consultation");
  return invoice;
}

async function automaticMarkersFor(invoiceId: string) {
  const markers = await db.select().from(automaticInvoiceChargesTable);
  return markers.filter((marker) => marker.invoiceId === invoiceId);
}

async function createNewVisit(label: string) {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const [patient] = await db.insert(patientsTable).values({
    patientId: `TEST-${suffix}`,
    fullName: `Billing Test ${label}`,
    gender: "other",
  }).returning();
  const [token] = await db.insert(queueTokensTable).values({
    tokenNumber: 1,
    patientId: patient.id,
    doctorId: testUserId,
    visitType: "new",
    queueDate: "2026-08-21",
  }).returning();

  const result = await request("/consultations", {
    method: "POST",
    body: JSON.stringify({
      patientId: patient.id,
      doctorId: testUserId,
      tokenId: token.id,
      chiefComplaint: "Automatic billing regression coverage",
    }),
  });

  assert.equal(result.response.status, 201);
  assert.ok(result.body);
  const consultationId = String(result.body.id);
  return {
    patient,
    consultationId,
    invoice: await invoiceForConsultation(consultationId),
  };
}

async function orderXray(visit: Awaited<ReturnType<typeof createNewVisit>>) {
  const result = await request("/investigations", {
    method: "POST",
    body: JSON.stringify({
      patientId: visit.patient.id,
      patientName: visit.patient.fullName,
      consultationId: visit.consultationId,
      requestedById: testUserId,
      requestedByName: "Billing Test User",
      type: "X-Ray",
      bodyPart: "Chest",
    }),
  });

  assert.equal(result.response.status, 201);
  assert.ok(result.body);
  return String(result.body.id);
}

before(async () => {
  await pool.query(`CREATE SCHEMA "${schema}"`);
  for (const table of tablesToClone) {
    await pool.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
  }
  await pool.query(`CREATE SEQUENCE "${schema}".invoice_number_sequence START 1`);

  const [user] = await db.insert(usersTable).values({
    username: `billing-test-${randomUUID()}`,
    passwordHash: "not-used-by-this-test",
    role: "admin",
    fullName: "Billing Test User",
  }).returning();
  testUserId = user.id;
  authToken = createJWT({ sub: user.id, role: user.role, username: user.username }, 60);

  await db.insert(chargeTypesTable).values([
    {
      name: "New Visit Consultation",
      category: "consultation",
      unitPrice: 500,
      taxPercent: 0,
      autoBillingKey: "new_visit_consultation",
    },
    {
      name: "X-Ray",
      category: "investigation",
      unitPrice: 300,
      taxPercent: 0,
      autoBillingKey: "xray",
    },
  ]);

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await pool.end();
});

test("new visits automatically add the configured consultation fee", async () => {
  const visit = await createNewVisit("consultation");
  const invoice = visit.invoice;
  const items = invoice.items as Array<Record<string, unknown>>;

  assert.equal(invoice.status, "pending");
  assert.equal(invoice.subtotal, 500);
  assert.equal(invoice.total, 500);
  assert.equal(invoice.balance, 500);
  assert.deepEqual(items, [{
    chargeTypeId: items[0]?.chargeTypeId,
    description: "New Visit Consultation",
    quantity: 1,
    unitPrice: 500,
    discount: 0,
    tax: 0,
    total: 500,
    autoSourceKey: `automatic:consultation:${visit.consultationId}`,
  }]);

  const markers = await automaticMarkersFor(invoice.id);
  assert.deepEqual(markers.map((marker) => marker.sourceKey), [
    `automatic:consultation:${visit.consultationId}`,
  ]);

  const repeatedCharge = await addAutomaticCharge({
    kind: "consultation",
    consultationId: visit.consultationId,
    patientId: visit.patient.id,
    doctorId: testUserId,
    createdById: testUserId,
    sourceId: visit.consultationId,
  });
  assert.deepEqual(repeatedCharge, { status: "already_billed", invoiceId: invoice.id });
  const unchangedInvoice = await invoiceForConsultation(visit.consultationId);
  assert.equal((unchangedInvoice.items as unknown[]).length, 1);
});

test("linked X-Rays share the open receipt and the same source cannot bill twice", async () => {
  const visit = await createNewVisit("xray");
  const investigationId = await orderXray(visit);
  const invoice = await invoiceForConsultation(visit.consultationId);
  const items = invoice.items as Array<Record<string, unknown>>;

  assert.equal(invoice.id, visit.invoice.id);
  assert.equal(invoice.total, 800);
  assert.deepEqual(items.map((item) => item.description), ["New Visit Consultation", "X-Ray"]);

  const repeatedCharge = await addAutomaticCharge({
    kind: "xray",
    consultationId: visit.consultationId,
    patientId: visit.patient.id,
    doctorId: testUserId,
    createdById: testUserId,
    sourceId: investigationId,
  });
  assert.deepEqual(repeatedCharge, { status: "already_billed", invoiceId: invoice.id });

  const unchangedInvoice = await invoiceForConsultation(visit.consultationId);
  assert.equal((unchangedInvoice.items as unknown[]).length, 2);
  assert.equal(unchangedInvoice.total, 800);
  const markers = await automaticMarkersFor(invoice.id);
  assert.deepEqual(markers.map((marker) => marker.sourceKey).sort(), [
    `automatic:consultation:${visit.consultationId}`,
    `automatic:xray:${investigationId}`,
  ]);
});

test("paid receipts stay immutable and later X-Rays receive a new receipt", async () => {
  const visit = await createNewVisit("paid");
  const payment = await request(`/billing/invoices/${visit.invoice.id}/pay`, {
    method: "POST",
    body: JSON.stringify({ amount: 500, paymentMode: "cash" }),
  });
  assert.equal(payment.response.status, 200);

  const paidInvoice = await invoiceForConsultation(visit.consultationId);
  assert.equal(paidInvoice.status, "paid");
  assert.equal(paidInvoice.amountPaid, 500);
  assert.equal(paidInvoice.balance, 0);

  const edit = await request(`/billing/invoices/${paidInvoice.id}`, {
    method: "PATCH",
    body: JSON.stringify({ notes: "this edit must be rejected" }),
  });
  assert.equal(edit.response.status, 409);
  assert.equal(edit.body?.error, "Paid invoices cannot be edited. Create a new invoice for additional charges.");

  const unchangedPaidInvoice = await invoiceForConsultation(visit.consultationId);
  assert.equal(unchangedPaidInvoice.notes, "Automatically generated");
  assert.equal(unchangedPaidInvoice.total, 500);

  const xrayInvestigationId = await orderXray(visit);
  const invoices = (await db.select().from(invoicesTable))
    .filter((invoice) => invoice.consultationId === visit.consultationId);
  assert.equal(invoices.length, 2);

  const xrayInvoice = invoices.find((invoice) => invoice.id !== paidInvoice.id);
  assert.ok(xrayInvoice, "expected a new invoice for the X-Ray");
  assert.equal(xrayInvoice.status, "pending");
  assert.equal(xrayInvoice.total, 300);
  assert.deepEqual(
    (xrayInvoice.items as Array<Record<string, unknown>>).map((item) => item.description),
    ["X-Ray"],
  );

  const preservedPaidInvoice = invoices.find((invoice) => invoice.id === paidInvoice.id);
  assert.ok(preservedPaidInvoice);
  assert.equal(preservedPaidInvoice.status, "paid");
  assert.equal(preservedPaidInvoice.total, 500);
  const xrayMarkers = await automaticMarkersFor(xrayInvoice.id);
  assert.deepEqual(xrayMarkers.map((marker) => marker.sourceKey), [
    `automatic:xray:${xrayInvestigationId}`,
  ]);
});