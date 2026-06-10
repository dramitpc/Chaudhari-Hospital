import { useAuth } from "@/contexts/AuthContext";
import { 
  useGetDashboardSummary, 
  getGetDashboardSummaryQueryKey,
  useGetQueueStatus,
  getGetQueueStatusQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, Activity, CalendarClock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { user } = useAuth();

  const localToday = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in browser local tz

  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary(
    { date: localToday },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ date: localToday }) } }
  );

  const { data: queueStatus, isLoading: isQueueLoading } = useGetQueueStatus({
    query: {
      queryKey: getGetQueueStatusQueryKey()
    }
  });

  const isDoctor = user?.role === "doctor" || user?.role === "admin";
  const isStaff = user?.role === "staff" || user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          {summary?.today && (
            <p className="text-sm text-muted-foreground mt-0.5">
              Today — {summary.today.split("-").reverse().join("/")}
            </p>
          )}
        </div>
        <p className="text-muted-foreground">
          Welcome back, {user?.role === "doctor" ? `Dr. ${user?.fullName}` : user?.fullName}
        </p>
      </div>

      {isSummaryLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[60px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Today's Patients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.todayPatients}</div>
              <p className="text-xs text-muted-foreground">
                Total registered today
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Pending Queue</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.pendingQueue}</div>
              <p className="text-xs text-muted-foreground">
                Patients waiting
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">Appointments</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.todayAppointments}</div>
              <p className="text-xs text-muted-foreground">
                Scheduled for today
              </p>
            </CardContent>
          </Card>

          {isStaff && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Today's Revenue</CardTitle>
                <CreditCard className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">₹{summary.todayRevenue.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  Total collected today
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {isDoctor && queueStatus && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Your Queue Status</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {queueStatus.map(status => (
              <Card key={status.doctorId} className="border-l-4 border-l-primary">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{status.doctorName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">Waiting</span>
                    <span className="font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-500 px-2 py-0.5 rounded-full text-xs">
                      {status.waiting}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-muted-foreground">In Progress</span>
                    <span className="font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-500 px-2 py-0.5 rounded-full text-xs">
                      {status.inProgress}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 px-2 py-0.5 rounded-full text-xs">
                      {status.completed}
                    </span>
                  </div>
                  {status.currentPatientName && (
                    <div className="mt-4 pt-4 border-t text-sm">
                      <span className="text-muted-foreground block text-xs">Currently Serving</span>
                      <span className="font-medium">{status.currentPatientName} (Token #{status.currentToken})</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
