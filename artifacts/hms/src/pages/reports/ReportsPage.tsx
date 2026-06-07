import { useState } from "react";
import {
  useGetDailyOpdReport, useGetRevenueReport, useGetDoctorProductivityReport,
  getGetDailyOpdReportQueryKey, getGetRevenueReportQueryKey, getGetDoctorProductivityReportQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export default function ReportsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toLocaleDateString("en-CA");

  const [opdDate, setOpdDate] = useState(today);
  const [revenueStart, setRevenueStart] = useState(thirtyDaysAgo);
  const [revenueEnd, setRevenueEnd] = useState(today);
  const [prodStart, setProdStart] = useState(thirtyDaysAgo);
  const [prodEnd, setProdEnd] = useState(today);

  const { data: opdReport, isLoading: opdLoading } = useGetDailyOpdReport(
    { date: opdDate },
    { query: { queryKey: getGetDailyOpdReportQueryKey({ date: opdDate }) } }
  );
  const { data: revenueReport, isLoading: revLoading } = useGetRevenueReport(
    { startDate: revenueStart, endDate: revenueEnd },
    { query: { queryKey: getGetRevenueReportQueryKey({ startDate: revenueStart, endDate: revenueEnd }) } }
  );
  const { data: prodReport, isLoading: prodLoading } = useGetDoctorProductivityReport(
    { startDate: prodStart, endDate: prodEnd },
    { query: { queryKey: getGetDoctorProductivityReportQueryKey({ startDate: prodStart, endDate: prodEnd }) } }
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics and operational reports</p>
      </div>

      <Tabs defaultValue="daily-opd">
        <div className="overflow-x-auto pb-1">
          <TabsList className="w-max min-w-full">
            <TabsTrigger value="daily-opd">Daily OPD</TabsTrigger>
            <TabsTrigger value="revenue">Revenue</TabsTrigger>
            <TabsTrigger value="productivity" className="text-xs sm:text-sm">Doctor Productivity</TabsTrigger>
          </TabsList>
        </div>

        {/* Daily OPD */}
        <TabsContent value="daily-opd" className="mt-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input type="date" value={opdDate} onChange={e => setOpdDate(e.target.value)} className="w-44" />
            </div>
          </div>

          {opdLoading ? <Skeleton className="h-64 w-full" /> : opdReport && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Patients", value: opdReport.totalPatients },
                  { label: "New Patients", value: opdReport.newPatients },
                  { label: "Follow-ups", value: opdReport.followUps },
                  { label: "Total Revenue", value: `₹${opdReport.totalRevenue.toFixed(2)}` },
                ].map(card => (
                  <div key={card.label} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-sm mb-3">Doctor-wise Summary</h3>
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground">
                      <th className="text-left py-1">Doctor</th>
                      <th className="text-right py-1">Patients</th>
                      <th className="text-right py-1">Revenue</th>
                    </tr></thead>
                    <tbody>
                      {opdReport.byDoctor.map(d => (
                        <tr key={d.doctorId} className="border-t border-border">
                          <td className="py-1.5">{d.doctorName}</td>
                          <td className="py-1.5 text-right">{d.patients}</td>
                          <td className="py-1.5 text-right">₹{d.revenue.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-semibold text-sm mb-3">Payment Mode Breakdown</h3>
                  {opdReport.byPaymentMode && opdReport.byPaymentMode.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={opdReport.byPaymentMode} dataKey="amount" nameKey="mode" cx="50%" cy="50%" outerRadius={70} label={({ mode, percent }) => `${mode} ${(percent * 100).toFixed(0)}%`}>
                          {opdReport.byPaymentMode.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-muted-foreground text-sm">No payment data</p>}
                </div>
              </div>

              {/* Revenue Generation Table */}
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Day's Revenue Generation</h3>
                  <span className="text-xs text-muted-foreground">
                    {(opdReport.revenueList ?? []).length} paid &middot; {(opdReport.pendingList ?? []).length} pending
                  </span>
                </div>
                <Tabs defaultValue="paid" className="w-full">
                  <div className="px-4 pt-3 pb-1">
                    <TabsList className="w-full">
                      <TabsTrigger value="paid" className="flex-1 text-xs sm:text-sm">
                        Paid Invoices ({(opdReport.revenueList ?? []).length})
                      </TabsTrigger>
                      <TabsTrigger value="pending" className="flex-1 text-xs sm:text-sm">
                        Pending Invoices ({(opdReport.pendingList ?? []).length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* ── Paid tab ── */}
                  <TabsContent value="paid" className="mt-0">
                    {(opdReport.revenueList ?? []).length === 0 ? (
                      <p className="px-4 py-8 text-sm text-muted-foreground text-center">No paid invoices for this date</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 border-b border-border">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Patient Name</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice #</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Charge Type</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Qty</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Unit Price</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Disc (₹)</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(opdReport.revenueList ?? []).flatMap((inv, ii) =>
                              inv.items.map((item, li) => (
                                <tr key={`paid-${ii}-${li}`} className="border-t border-border hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{li === 0 ? inv.patientName : ""}</td>
                                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{li === 0 ? inv.invoiceNumber : ""}</td>
                                  <td className="px-4 py-2.5">
                                    {item.chargeTypeName ? (
                                      <span className="inline-flex px-2 py-0.5 rounded bg-muted text-xs capitalize">{item.chargeTypeName}</span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{item.description}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">₹{(item.unitPrice ?? 0).toFixed(2)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                                    {item.discount ? `₹${item.discount.toFixed(2)}` : "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">₹{item.total.toFixed(2)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot className="border-t-2 border-border bg-muted/20">
                            <tr>
                              <td colSpan={7} className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Collected Revenue</td>
                              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-green-700 dark:text-green-400">
                                ₹{(opdReport.revenueList ?? []).reduce((s, inv) => s + (inv.amountPaid ?? inv.total), 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  {/* ── Pending tab ── */}
                  <TabsContent value="pending" className="mt-0">
                    {(opdReport.pendingList ?? []).length === 0 ? (
                      <p className="px-4 py-8 text-sm text-muted-foreground text-center">No pending invoices for this date</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/40 border-b border-border">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Patient Name</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Invoice #</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Charge Type</th>
                              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Description</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Qty</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Unit Price</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Disc (₹)</th>
                              <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Amount</th>
                              <th className="px-4 py-2.5 text-center text-xs font-medium text-muted-foreground">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(opdReport.pendingList ?? []).flatMap((inv, ii) =>
                              inv.items.map((item, li) => (
                                <tr key={`pend-${ii}-${li}`} className="border-t border-border hover:bg-muted/30 transition-colors">
                                  <td className="px-4 py-2.5 font-medium whitespace-nowrap">{li === 0 ? inv.patientName : ""}</td>
                                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">{li === 0 ? inv.invoiceNumber : ""}</td>
                                  <td className="px-4 py-2.5">
                                    {item.chargeTypeName ? (
                                      <span className="inline-flex px-2 py-0.5 rounded bg-muted text-xs capitalize">{item.chargeTypeName}</span>
                                    ) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                  <td className="px-4 py-2.5 text-muted-foreground">{item.description}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">{item.quantity}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums">₹{(item.unitPrice ?? 0).toFixed(2)}</td>
                                  <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                                    {item.discount ? `₹${item.discount.toFixed(2)}` : "—"}
                                  </td>
                                  <td className="px-4 py-2.5 text-right tabular-nums font-medium">₹{item.total.toFixed(2)}</td>
                                  <td className="px-4 py-2.5 text-center">
                                    {li === 0 ? (
                                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize
                                        ${inv.status === "partial" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                                        : inv.status === "draft" ? "bg-muted text-muted-foreground"
                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                                        {inv.status}
                                      </span>
                                    ) : ""}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          <tfoot className="border-t-2 border-border bg-muted/20">
                            <tr>
                              <td colSpan={8} className="px-4 py-2.5 text-xs font-medium text-muted-foreground text-right">Pending Balance</td>
                              <td className="px-4 py-2.5 text-right font-bold tabular-nums text-yellow-700 dark:text-yellow-400">
                                ₹{(opdReport.pendingList ?? []).reduce((s, inv) => s + (inv.balance ?? inv.total), 0).toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </TabsContent>

        {/* Revenue */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={revenueStart} onChange={e => setRevenueStart(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={revenueEnd} onChange={e => setRevenueEnd(e.target.value)} className="w-full" />
            </div>
          </div>

          {revLoading ? <Skeleton className="h-64 w-full" /> : revenueReport && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Revenue", value: `₹${revenueReport.totalRevenue.toFixed(2)}` },
                  { label: "Total Invoices", value: revenueReport.totalInvoices },
                  { label: "Collected", value: `₹${revenueReport.collected.toFixed(2)}` },
                  { label: "Pending", value: `₹${revenueReport.pending.toFixed(2)}` },
                ].map(card => (
                  <div key={card.label} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-xs text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold mt-1">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-sm mb-3">Daily Revenue Trend</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueReport.daily ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                    <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Charge-type breakdown */}
              {(revenueReport.byChargeType ?? []).length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category pie */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold text-sm mb-3">Revenue by Category</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={revenueReport.byCategory ?? []}
                          dataKey="total"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          label={({ name, percent }: { name: string; percent: number }) =>
                            `${name} ${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {(revenueReport.byCategory ?? []).map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Charge-type bar chart */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h3 className="font-semibold text-sm mb-3">Top Charge Types</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart
                        data={(revenueReport.byChargeType ?? []).slice(0, 8)}
                        layout="vertical"
                        margin={{ left: 8, right: 16 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${v}`} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                        <Tooltip formatter={(v: number) => `₹${v.toFixed(2)}`} />
                        <Bar dataKey="total" name="Revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Detailed table */}
                  <div className="md:col-span-2 rounded-lg border border-border bg-card overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <h3 className="font-semibold text-sm">Charge Type-wise Breakdown</h3>
                    </div>
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Charge Type</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Category</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Line Items</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">Total</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground">% of Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(revenueReport.byChargeType ?? []).map((row, i) => (
                          <tr key={i} className="border-t border-border">
                            <td className="px-4 py-2 font-medium">{row.name}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-muted capitalize">
                                {row.category ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-muted-foreground">{row.count}</td>
                            <td className="px-4 py-2 text-right font-medium">₹{row.total.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right text-muted-foreground">
                              {revenueReport.totalRevenue > 0
                                ? `${((row.total / revenueReport.totalRevenue) * 100).toFixed(1)}%`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Doctor Productivity */}
        <TabsContent value="productivity" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={prodStart} onChange={e => setProdStart(e.target.value)} className="w-full" />
            </div>
            <div className="space-y-1 flex-1 min-w-[140px]">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={prodEnd} onChange={e => setProdEnd(e.target.value)} className="w-full" />
            </div>
          </div>

          {prodLoading ? <Skeleton className="h-64 w-full" /> : prodReport && (
            <>
              <div className="rounded-lg border border-border bg-card p-4">
                <h3 className="font-semibold text-sm mb-3">Patients by Doctor</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={prodReport.doctors}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="doctorName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="totalPatients" name="Patients" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Patients</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Avg/Day</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Prescriptions</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Certificates</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prodReport.doctors.map(d => (
                      <tr key={d.doctorId} className="border-b border-border">
                        <td className="px-4 py-3 font-medium">{d.doctorName}</td>
                        <td className="px-4 py-3 text-right">{d.totalPatients}</td>
                        <td className="px-4 py-3 text-right">{d.avgPerDay}</td>
                        <td className="px-4 py-3 text-right">{d.prescriptions}</td>
                        <td className="px-4 py-3 text-right">{d.certificates}</td>
                        <td className="px-4 py-3 text-right">₹{d.totalRevenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
