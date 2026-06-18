import { useState } from "react";
import { Link } from "wouter";
import { useListInvoices, getListInvoicesQueryKey } from "@workspace/api-client-react";
import { fmtDate } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ChevronLeft, ChevronRight, CalendarDays, X } from "lucide-react";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  refunded: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

const statusList = ["all", "pending", "paid", "partial", "draft", "cancelled"];

function todayIso() {
  return new Date().toLocaleDateString("en-CA");
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA");
}

function fmtPickerDate(iso: string) {
  const today = todayIso();
  const yesterday = shiftDate(today, -1);
  if (iso === today) return "Today";
  if (iso === yesterday) return "Yesterday";
  return fmtDate(iso + "T00:00:00");
}

export default function BillingPage() {
  const [activeStatus, setActiveStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const limit = 20;

  const dateFilter = activeStatus === "all" ? selectedDate : undefined;

  const { data, isLoading } = useListInvoices(
    { status: activeStatus === "all" ? undefined : activeStatus, date: dateFilter, page, limit },
    { query: { queryKey: getListInvoicesQueryKey({ status: activeStatus === "all" ? undefined : activeStatus, date: dateFilter, page, limit }) } }
  );

  const invoices = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);
  const isToday = selectedDate === todayIso();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Billing</h1>
          <p className="text-sm text-muted-foreground">{total} invoice{total !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/billing/new">
          <Button data-testid="btn-new-invoice">
            <Plus className="mr-2 h-4 w-4" />
            New Invoice
          </Button>
        </Link>
      </div>

      {/* Date picker row */}
      <div className={`flex flex-wrap items-center gap-2 transition-opacity ${activeStatus !== "all" ? "opacity-40 pointer-events-none select-none" : ""}`}>
        <div className="flex items-center border border-border rounded-md bg-background shadow-sm overflow-hidden">
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 rounded-none border-r border-border"
            onClick={() => { setSelectedDate(d => shiftDate(d, -1)); setPage(1); }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="relative flex items-center">
            <CalendarDays className="absolute left-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="date"
              value={selectedDate}
              max={todayIso()}
              onChange={e => { if (e.target.value) { setSelectedDate(e.target.value); setPage(1); } }}
              className="h-9 pl-8 pr-2 text-sm bg-transparent focus:outline-none min-w-[130px] cursor-pointer"
            />
          </div>
          <span className={`px-2 text-xs font-medium border-l border-border h-9 flex items-center ${isToday ? "text-primary" : "text-muted-foreground"}`}>
            {fmtPickerDate(selectedDate)}
          </span>
          <Button
            variant="ghost" size="icon"
            className="h-9 w-9 rounded-none border-l border-border"
            disabled={isToday}
            onClick={() => { setSelectedDate(d => shiftDate(d, 1)); setPage(1); }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {!isToday && (
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => { setSelectedDate(todayIso()); setPage(1); }}>
            <X className="h-3.5 w-3.5" />Today
          </Button>
        )}
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-1 bg-muted/30 rounded-lg p-1">
        {statusList.map(s => (
          <button
            key={s}
            onClick={() => { setActiveStatus(s); setPage(1); }}
            className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${activeStatus === s ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            data-testid={`filter-${s}`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Invoice #</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">Date</th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground">Total</th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Paid</th>
              <th className="px-3 py-3 text-right font-medium text-muted-foreground hidden sm:table-cell">Balance</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-3 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 5 }).map((__, j) => <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>)}
              </tr>
            )) : invoices.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">{activeStatus === "all" ? `No invoices for ${fmtPickerDate(selectedDate)}` : `No ${activeStatus} invoices`}</td></tr>
            ) : invoices.map(inv => (
              <tr key={inv.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-3 py-3 font-mono text-xs text-primary">{inv.invoiceNumber}</td>
                <td className="px-3 py-3 font-medium">{inv.patientName}</td>
                <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">{fmtDate(inv.createdAt)}</td>
                <td className="px-3 py-3 text-right font-medium">₹{inv.total.toFixed(2)}</td>
                <td className="px-3 py-3 text-right text-green-600 hidden sm:table-cell">₹{(inv.amountPaid ?? 0).toFixed(2)}</td>
                <td className="px-3 py-3 text-right text-amber-600 hidden sm:table-cell">₹{(inv.balance ?? 0).toFixed(2)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status] ?? ""}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/billing/${inv.id}?from=billing`}>
                    <Button size="sm" variant="outline">View</Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
