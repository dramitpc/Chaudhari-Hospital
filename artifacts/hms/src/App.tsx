import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/layout/Layout";

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";

import PatientsPage from "@/pages/patients/PatientsPage";
import RegisterPatientPage from "@/pages/patients/RegisterPatientPage";
import PatientDetailPage from "@/pages/patients/PatientDetailPage";
import EditPatientPage from "@/pages/patients/EditPatientPage";

import AppointmentsPage from "@/pages/appointments/AppointmentsPage";

import QueuePage from "@/pages/queue/QueuePage";

import ConsultationsPage from "@/pages/consultations/ConsultationsPage";
import ConsultationDetailPage from "@/pages/consultations/ConsultationDetailPage";

import PrescriptionsPage from "@/pages/prescriptions/PrescriptionsPage";
import PrescriptionDetailPage from "@/pages/prescriptions/PrescriptionDetailPage";

import BillingPage from "@/pages/billing/BillingPage";
import NewInvoicePage from "@/pages/billing/NewInvoicePage";
import InvoiceDetailPage from "@/pages/billing/InvoiceDetailPage";

import CertificatesPage from "@/pages/certificates/CertificatesPage";
import CertificateDetailPage from "@/pages/certificates/CertificateDetailPage";

import ReportsPage from "@/pages/reports/ReportsPage";
import InvestigationsPage from "@/pages/investigations/InvestigationsPage";

import UsersPage from "@/pages/admin/UsersPage";
import DrugsPage from "@/pages/admin/DrugsPage";
import AuditLogsPage from "@/pages/admin/AuditLogsPage";
import SettingsPage from "@/pages/admin/SettingsPage";
import ChargesMasterPage from "@/pages/admin/ChargesMasterPage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30000 },
  },
});

function Protected({ children, roles }: { children: React.ReactNode; roles?: ("admin" | "doctor" | "staff" | "radiographer")[] }) {
  return (
    <ProtectedRoute allowedRoles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>

      <Route path="/dashboard">
        <Protected><Dashboard /></Protected>
      </Route>

      {/* Patients — more specific routes first */}
      <Route path="/patients/register">
        <Protected><RegisterPatientPage /></Protected>
      </Route>
      <Route path="/patients/:id/edit">
        <Protected><EditPatientPage /></Protected>
      </Route>
      <Route path="/patients/:id">
        <Protected><PatientDetailPage /></Protected>
      </Route>
      <Route path="/patients">
        <Protected><PatientsPage /></Protected>
      </Route>

      {/* Appointments */}
      <Route path="/appointments">
        <Protected><AppointmentsPage /></Protected>
      </Route>

      {/* Queue */}
      <Route path="/queue">
        <Protected><QueuePage /></Protected>
      </Route>

      {/* Consultations */}
      <Route path="/consultations/:id">
        <Protected roles={["admin", "doctor"]}><ConsultationDetailPage /></Protected>
      </Route>
      <Route path="/consultations">
        <Protected roles={["admin", "doctor"]}><ConsultationsPage /></Protected>
      </Route>

      {/* Prescriptions */}
      <Route path="/prescriptions/:id">
        <Protected roles={["admin", "doctor"]}><PrescriptionDetailPage /></Protected>
      </Route>
      <Route path="/prescriptions">
        <Protected roles={["admin", "doctor"]}><PrescriptionsPage /></Protected>
      </Route>

      {/* Billing — more specific routes first */}
      <Route path="/billing/new">
        <Protected><NewInvoicePage /></Protected>
      </Route>
      <Route path="/billing/:id">
        <Protected><InvoiceDetailPage /></Protected>
      </Route>
      <Route path="/billing">
        <Protected><BillingPage /></Protected>
      </Route>

      {/* Certificates */}
      <Route path="/certificates/:id">
        <Protected roles={["admin", "doctor"]}><CertificateDetailPage /></Protected>
      </Route>
      <Route path="/certificates">
        <Protected roles={["admin", "doctor"]}><CertificatesPage /></Protected>
      </Route>

      {/* Investigations */}
      <Route path="/investigations">
        <Protected roles={["admin", "doctor", "radiographer"]}><InvestigationsPage /></Protected>
      </Route>

      {/* Reports */}
      <Route path="/reports">
        <Protected roles={["admin", "doctor"]}><ReportsPage /></Protected>
      </Route>

      {/* Admin */}
      <Route path="/admin/users">
        <Protected roles={["admin"]}><UsersPage /></Protected>
      </Route>
      <Route path="/admin/drugs">
        <Protected roles={["admin"]}><DrugsPage /></Protected>
      </Route>
      <Route path="/admin/charges">
        <Protected roles={["admin"]}><ChargesMasterPage /></Protected>
      </Route>
      <Route path="/admin/audit-logs">
        <Protected roles={["admin"]}><AuditLogsPage /></Protected>
      </Route>
      <Route path="/admin/settings">
        <Protected roles={["admin"]}><SettingsPage /></Protected>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
