import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  Calendar,
  ListOrdered,
  Stethoscope,
  Pill,
  Receipt,
  FileText,
  BarChart,
  Settings,
  ShieldCheck,
  Database,
  BadgeDollarSign,
  LogOut,
  Moon,
  Sun,
  ScanLine,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

function SidebarContent({ onNavClick }: { onNavClick: () => void }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const role = user.role;
  const isAdmin = role === "admin";
  const isDoctor = role === "doctor" || isAdmin;
  const isStaff = role === "staff" || isAdmin;
  const isRadiographer = role === "radiographer" || isAdmin;

  const navItems = [
    { name: "Dashboard",      href: "/dashboard",         icon: LayoutDashboard, show: !isRadiographer || isAdmin },
    { name: "Patients",       href: "/patients",           icon: Users,           show: !isRadiographer || isAdmin },
    { name: "Appointments",   href: "/appointments",       icon: Calendar,        show: isStaff && !isRadiographer },
    { name: "Queue",          href: "/queue",              icon: ListOrdered,     show: !isRadiographer || isAdmin },
    { name: "Consultations",  href: "/consultations",      icon: Stethoscope,     show: isDoctor },
    { name: "Prescriptions",  href: "/prescriptions",      icon: Pill,            show: isDoctor },
    { name: "Investigations", href: "/investigations",     icon: ScanLine,        show: isRadiographer || isDoctor },
    { name: "Billing",        href: "/billing",            icon: Receipt,         show: isStaff && !isRadiographer },
    { name: "Certificates",   href: "/certificates",       icon: FileText,        show: isDoctor },
    { name: "Reports",        href: "/reports",            icon: BarChart,        show: isDoctor },
    { name: "Users",          href: "/admin/users",        icon: ShieldCheck,     show: isAdmin, group: "Admin" },
    { name: "Drugs Master",   href: "/admin/drugs",        icon: Database,        show: isAdmin, group: "Admin" },
    { name: "Charges Master", href: "/admin/charges",      icon: BadgeDollarSign, show: isAdmin, group: "Admin" },
    { name: "Audit Logs",     href: "/admin/audit-logs",   icon: FileText,        show: isAdmin, group: "Admin" },
    { name: "Settings",       href: "/admin/settings",     icon: Settings,        show: isAdmin, group: "Admin" },
  ];

  return (
    <>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.filter(item => item.show && !item.group).map((item) => (
            <Link key={item.name} href={item.href} onClick={onNavClick} className="block">
              <span
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                  location.startsWith(item.href)
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="mr-3 h-5 w-5 flex-shrink-0 opacity-70" />
                {item.name}
              </span>
            </Link>
          ))}

          {isAdmin && (
            <div className="mt-6">
              <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Administration
              </h3>
              {navItems.filter(item => item.show && item.group === "Admin").map((item) => (
                <Link key={item.name} href={item.href} onClick={onNavClick} className="block mt-1">
                  <span
                    data-testid={`nav-admin-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      location.startsWith(item.href)
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="mr-3 h-5 w-5 flex-shrink-0 opacity-70" />
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </nav>
      </div>

      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[140px]" data-testid="sidebar-user-name">
              {user.fullName}
            </span>
            <span className="text-xs text-sidebar-foreground/70 capitalize" data-testid="sidebar-user-role">
              {user.role}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Toggle theme"
            data-testid="btn-toggle-theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <Button
          variant="outline"
          className="w-full justify-start text-sidebar-foreground"
          onClick={() => { onNavClick(); logout(); }}
          data-testid="btn-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-72 flex flex-col bg-sidebar border-r border-sidebar-border md:hidden print:hidden",
          "transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-primary" />
            <span className="text-base font-bold text-sidebar-foreground">ClinicOS</span>
          </div>
          <button
            onClick={onClose}
            className="text-sidebar-foreground/60 hover:text-sidebar-foreground transition-colors p-1 rounded"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent onNavClick={onClose} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex h-screen w-64 shrink-0 flex-col bg-sidebar border-r border-sidebar-border sticky top-0 print:hidden">
        <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
          <Stethoscope className="h-6 w-6 text-primary mr-2" />
          <span className="text-lg font-bold text-sidebar-foreground">ClinicOS</span>
        </div>
        <SidebarContent onNavClick={() => {}} />
      </aside>
    </>
  );
}
