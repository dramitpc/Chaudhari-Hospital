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
  Sun
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const role = user.role;
  const isAdmin = role === "admin";
  const isDoctor = role === "doctor" || isAdmin;
  const isStaff = role === "staff" || isAdmin;

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, show: true },
    { name: "Patients", href: "/patients", icon: Users, show: true },
    { name: "Appointments", href: "/appointments", icon: Calendar, show: isStaff },
    { name: "Queue", href: "/queue", icon: ListOrdered, show: true },
    { name: "Consultations", href: "/consultations", icon: Stethoscope, show: isDoctor },
    { name: "Prescriptions", href: "/prescriptions", icon: Pill, show: isDoctor },
    { name: "Billing", href: "/billing", icon: Receipt, show: isStaff },
    { name: "Certificates", href: "/certificates", icon: FileText, show: isDoctor },
    { name: "Reports", href: "/reports", icon: BarChart, show: isDoctor },
    
    // Admin Only
    { name: "Users", href: "/admin/users", icon: ShieldCheck, show: isAdmin, group: "Admin" },
    { name: "Drugs Master", href: "/admin/drugs", icon: Database, show: isAdmin, group: "Admin" },
    { name: "Charges Master", href: "/admin/charges", icon: BadgeDollarSign, show: isAdmin, group: "Admin" },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: FileText, show: isAdmin, group: "Admin" },
    { name: "Settings", href: "/admin/settings", icon: Settings, show: isAdmin, group: "Admin" },
  ];

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border hidden md:flex print:hidden sticky top-0">
      <div className="flex h-16 shrink-0 items-center px-6 border-b border-sidebar-border">
        <Stethoscope className="h-6 w-6 text-primary mr-2" />
        <span className="text-lg font-bold text-sidebar-foreground">ClinicOS</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="space-y-1 px-3">
          {navItems.filter(item => item.show && !item.group).map((item) => (
            <Link key={item.name} href={item.href} className="block">
              <span
                data-testid={`nav-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
            <div className="mt-8">
              <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                Administration
              </h3>
              {navItems.filter(item => item.show && item.group === "Admin").map((item) => (
                <Link key={item.name} href={item.href} className="block mt-1">
                  <span
                    data-testid={`nav-admin-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                    className={cn(
                      "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
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
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle theme"
            data-testid="btn-toggle-theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <Button 
          variant="outline" 
          className="w-full justify-start text-sidebar-foreground" 
          onClick={logout}
          data-testid="btn-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
