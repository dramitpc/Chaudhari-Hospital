import { useState } from "react";
import { useListAuditLogs, getListAuditLogsQueryKey } from "@workspace/api-client-react";
import { fmtDateTime } from "@/lib/dateUtils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";

const actionColors: Record<string, string> = {
  LOGIN: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  LOGOUT: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  LOGIN_FAILED: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  CREATE_PATIENT: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CREATE_CONSULTATION: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CREATE_PRESCRIPTION: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CREATE_INVOICE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  CREATE_CERTIFICATE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  UPDATE_PATIENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE_USER: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  RESET_PASSWORD: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  RECORD_PAYMENT: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
};

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const limit = 50;
  const [actionFilter, setActionFilter] = useState("");
  const [resourceFilter, setResourceFilter] = useState("");

  const { data, isLoading } = useListAuditLogs(
    { action: actionFilter || undefined, resource: resourceFilter || undefined, page, limit },
    { query: { queryKey: getListAuditLogsQueryKey({ action: actionFilter || undefined, resource: resourceFilter || undefined, page, limit }) } }
  );

  const logs = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">HIPAA compliance audit trail — {total} entries</p>
      </div>

      <div className="flex gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Filter by Action</Label>
          <Input placeholder="e.g. LOGIN, CREATE_PATIENT" value={actionFilter}
            onChange={e => { setActionFilter(e.target.value); setPage(1); }} className="w-52" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Filter by Resource</Label>
          <Input placeholder="e.g. patients, auth" value={resourceFilter}
            onChange={e => { setResourceFilter(e.target.value); setPage(1); }} className="w-40" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Timestamp</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Resource ID</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">IP</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 8 }).map((__, j) => <td key={j} className="px-4 py-2"><Skeleton className="h-3 w-full" /></td>)}
              </tr>
            )) : logs.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">No audit logs found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-2 font-mono whitespace-nowrap">{fmtDateTime(log.createdAt)}</td>
                <td className="px-4 py-2 font-medium">{log.userName}</td>
                <td className="px-4 py-2 capitalize">{log.userRole}</td>
                <td className="px-4 py-2">
                  <span className={`inline-flex px-1.5 py-0.5 rounded font-medium ${actionColors[log.action] ?? "bg-gray-100 text-gray-700"}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-2 font-mono">{log.resource}</td>
                <td className="px-4 py-2 font-mono text-muted-foreground max-w-[100px] truncate">{log.resourceId ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground">{log.ipAddress ?? "—"}</td>
                <td className="px-4 py-2 text-muted-foreground max-w-[160px] truncate">{log.details ?? "—"}</td>
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
