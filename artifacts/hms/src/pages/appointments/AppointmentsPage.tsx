import { useState } from "react";
import { useDebounce } from "../../hooks/useDebounce";
import {
  useListAppointments, useListUsers, useCreateAppointment, useUpdateAppointment, useCancelAppointment,
  getListAppointmentsQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { CalendarPlus } from "lucide-react";
import { useListPatients, getListPatientsQueryKey } from "@workspace/api-client-react";

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  arrived: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  in_progress: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  no_show: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function AppointmentsPage() {
  const today = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState(today);
  const [doctorId, setDoctorId] = useState<string>("");
  const [showBooking, setShowBooking] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [apptPatientSearch, setApptPatientSearch] = useState("");
  const [apptPatientDropdownOpen, setApptPatientDropdownOpen] = useState(false);
  const [selectedApptPatient, setSelectedApptPatient] = useState<{ id: string; fullName: string; patientId: string; phone?: string | null } | null>(null);
  const debouncedApptSearch = useDebounce(apptPatientSearch, 300);
  const { register, handleSubmit, setValue, reset } = useForm();

  const { data: apptData, isLoading } = useListAppointments(
    { date, doctorId: doctorId || undefined },
    { query: { queryKey: getListAppointmentsQueryKey({ date, doctorId: doctorId || undefined }) } }
  );
  const { data: users } = useListUsers({ role: "doctor" }, { query: { queryKey: getListUsersQueryKey({ role: "doctor" }) } });
  const { data: patients } = useListPatients(
    { search: debouncedApptSearch || undefined, limit: 50 },
    { query: { queryKey: getListPatientsQueryKey({ search: debouncedApptSearch || undefined, limit: 50 }) } }
  );

  const createMutation = useCreateAppointment();
  const updateMutation = useUpdateAppointment();
  const cancelMutation = useCancelAppointment();

  const appointments = apptData?.data ?? [];
  const doctors = users?.data ?? [];

  const onBook = (data: Record<string, string>) => {
    createMutation.mutate({ data: {
      patientId: data.patientId,
      doctorId: data.doctorId,
      appointmentDate: data.appointmentDate,
      appointmentTime: data.appointmentTime || undefined,
      reason: data.reason || undefined,
    }}, {
      onSuccess: () => {
        toast({ title: "Appointment booked" });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setShowBooking(false);
        reset();
      },
      onError: () => toast({ title: "Error", description: "Failed to book appointment", variant: "destructive" }),
    });
  };

  const changeStatus = (id: string, status: string) => {
    updateMutation.mutate({ id, data: { status: status as "scheduled" | "confirmed" | "arrived" | "in_progress" | "completed" | "cancelled" | "no_show" }}, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Appointments</h1>
          <p className="text-sm text-muted-foreground">{appointments.length} appointments</p>
        </div>
        <Button onClick={() => setShowBooking(true)} data-testid="btn-book-appointment">
          <CalendarPlus className="mr-2 h-4 w-4" />
          Book Appointment
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full sm:w-44" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Doctor</Label>
          <Select onValueChange={v => setDoctorId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="All doctors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All doctors</SelectItem>
              {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Doctor</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Time</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Reason</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            )) : appointments.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No appointments</td></tr>
            ) : appointments.map(a => (
              <tr key={a.id} className="border-b border-border hover:bg-muted/20">
                <td className="px-4 py-3 font-medium">{a.patientName}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.doctorName}</td>
                <td className="px-4 py-3">{a.appointmentDate}</td>
                <td className="px-4 py-3">{a.appointmentTime ?? "-"}</td>
                <td className="px-4 py-3 max-w-[180px] truncate text-muted-foreground">{a.reason ?? "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColors[a.status] ?? ""}`}>
                    {a.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Select onValueChange={(v) => changeStatus(a.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                      {["scheduled", "confirmed", "arrived", "in_progress", "completed", "cancelled", "no_show"].map(s => (
                        <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={showBooking} onOpenChange={v => { setShowBooking(v); if (!v) { setSelectedApptPatient(null); setApptPatientSearch(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Book Appointment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onBook)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Patient</Label>
              <div className="relative">
                {selectedApptPatient ? (
                  <div
                    className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 cursor-pointer hover:bg-muted/50"
                    onClick={() => { setSelectedApptPatient(null); setApptPatientSearch(""); setValue("patientId", ""); }}
                  >
                    <div>
                      <p className="text-sm font-medium">{selectedApptPatient.fullName}</p>
                      <p className="text-xs text-muted-foreground">{selectedApptPatient.patientId}{selectedApptPatient.phone ? ` · ${selectedApptPatient.phone}` : ""}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">change</span>
                  </div>
                ) : (
                  <>
                    <Input
                      autoFocus
                      value={apptPatientSearch}
                      onChange={e => { setApptPatientSearch(e.target.value); setApptPatientDropdownOpen(true); }}
                      onFocus={() => setApptPatientDropdownOpen(true)}
                      placeholder="Search by name, patient ID, or mobile…"
                    />
                    {apptPatientDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md max-h-52 overflow-y-auto">
                        {(patients?.data ?? []).length === 0 ? (
                          <p className="px-3 py-2 text-sm text-muted-foreground">{apptPatientSearch ? "No patients found" : "Type to search…"}</p>
                        ) : (patients?.data ?? []).map(p => (
                          <button
                            key={p.id}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setSelectedApptPatient(p);
                              setValue("patientId", p.id);
                              setApptPatientSearch("");
                              setApptPatientDropdownOpen(false);
                            }}
                          >
                            <p className="text-sm font-medium">{p.fullName}</p>
                            <p className="text-xs text-muted-foreground">{p.patientId}{p.phone ? ` · ${p.phone}` : ""}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Doctor</Label>
              <Select onValueChange={v => setValue("doctorId", v)}>
                <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>
                  {doctors.map(d => <SelectItem key={d.id} value={d.id}>{d.fullName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" {...register("appointmentDate", { required: true })} defaultValue={today} />
              </div>
              <div className="space-y-1.5">
                <Label>Time (optional)</Label>
                <Input type="time" {...register("appointmentTime")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Input {...register("reason")} placeholder="Chief complaint / reason" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowBooking(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending}>Book</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
