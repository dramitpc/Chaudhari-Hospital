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
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

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
        <TabsList>
          <TabsTrigger value="daily-opd">Daily OPD</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="productivity">Doctor Productivity</TabsTrigger>
        </TabsList>

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
            </>
          )}
        </TabsContent>

        {/* Revenue */}
        <TabsContent value="revenue" className="mt-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={revenueStart} onChange={e => setRevenueStart(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={revenueEnd} onChange={e => setRevenueEnd(e.target.value)} className="w-44" />
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
            </>
          )}
        </TabsContent>

        {/* Doctor Productivity */}
        <TabsContent value="productivity" className="mt-4 space-y-4">
          <div className="flex items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" value={prodStart} onChange={e => setProdStart(e.target.value)} className="w-44" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Date</Label>
              <Input type="date" value={prodEnd} onChange={e => setProdEnd(e.target.value)} className="w-44" />
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
