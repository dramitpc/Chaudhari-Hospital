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
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useState } from "react";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  show: boolean;
  group?: string;
};

function SidebarContent({
  onNavClick,
  isExpanded,
  pinned,
  onTogglePin,
}: {
  onNavClick: () => void;
  isExpanded: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const { theme, setTheme } = useTheme();

  if (!user) return null;

  const role = user.role;
  const isAdmin = role === "admin";
  const isDoctor = role === "doctor" || isAdmin;
  const isStaff = role === "staff" || isAdmin;
  const isRadiographer = role === "radiographer" || isAdmin;

  const navItems: NavItem[] = [
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

  const renderNavItem = (item: NavItem, testPrefix = "nav") => (
    <Link key={item.name} href={item.href} onClick={onNavClick} className="block">
      <span
        data-testid={`${testPrefix}-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
        title={!isExpanded ? item.name : undefined}
        className={cn(
          "flex items-center rounded-md py-2.5 text-sm font-medium transition-colors",
          isExpanded ? "px-3 gap-0" : "px-0 justify-center",
          location.startsWith(item.href)
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
        )}
      >
        <item.icon className={cn("h-5 w-5 flex-shrink-0 opacity-70", isExpanded && "mr-3")} />
        {isExpanded && item.name}
      </span>
    </Link>
  );

  return (
    <>
      <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
        <nav className={cn("space-y-1", isExpanded ? "px-3" : "px-1.5")}>
          {navItems.filter(item => item.show && !item.group).map(item => renderNavItem(item))}

          {isAdmin && (
            <div className="mt-6">
              {isExpanded && (
                <h3 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2">
                  Administration
                </h3>
              )}
              {!isExpanded && <div className="border-t border-sidebar-border my-2" />}
              {navItems.filter(item => item.show && item.group === "Admin").map(item =>
                renderNavItem(item, "nav-admin")
              )}
            </div>
          )}
        </nav>
      </div>

      <div className={cn("border-t border-sidebar-border", isExpanded ? "p-4" : "p-2")}>
        {isExpanded ? (
          <>
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
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              title="Toggle theme"
              data-testid="btn-toggle-theme"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-1.5 rounded hover:bg-sidebar-accent/50 text-sidebar-foreground transition-colors"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              title="Logout"
              data-testid="btn-logout"
              onClick={() => { onNavClick(); logout(); }}
              className="p-1.5 rounded hover:bg-sidebar-accent/50 text-sidebar-foreground transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Pin/unpin toggle — desktop only, shown inside content */}
        <button
          onClick={onTogglePin}
          title={pinned ? "Collapse sidebar" : "Pin sidebar open"}
          className="mt-3 w-full flex items-center justify-center gap-1.5 rounded p-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/40 transition-colors"
        >
          {pinned
            ? <><PanelLeftClose className="h-4 w-4" />{isExpanded && <span>Collapse</span>}</>
            : <><PanelLeft className="h-4 w-4" />{isExpanded && <span>Pin open</span>}</>
          }
        </button>
      </div>
    </>
  );
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  pinned: boolean;
  onTogglePin: () => void;
}

export function Sidebar({ open, onClose, pinned, onTogglePin }: SidebarProps) {
  const { user } = useAuth();
  const [hovered, setHovered] = useState(false);

  if (!user) return null;

  const isExpanded = pinned || hovered;

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
        <SidebarContent onNavClick={onClose} isExpanded={true} pinned={pinned} onTogglePin={onTogglePin} />
      </aside>

      {/* Desktop sidebar — wrapper reserves space, aside overlays on hover */}
      <div
        className={cn(
          "hidden md:block relative sticky top-0 h-screen shrink-0 print:hidden",
          "transition-[width] duration-200 ease-in-out",
          pinned ? "w-64" : "w-14"
        )}
        onMouseEnter={() => !pinned && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <aside
          className={cn(
            "absolute left-0 top-0 h-full flex flex-col bg-sidebar border-r border-sidebar-border",
            "transition-[width] duration-200 ease-in-out overflow-hidden",
            isExpanded ? "w-64" : "w-14",
            !pinned && hovered && "shadow-2xl z-40"
          )}
        >
          {/* Header */}
          <div className={cn(
            "flex h-16 shrink-0 items-center border-b border-sidebar-border",
            isExpanded ? "px-6 gap-2" : "px-0 justify-center"
          )}>
            <Stethoscope className="h-6 w-6 text-primary flex-shrink-0" />
            {isExpanded && (
              <span className="text-lg font-bold text-sidebar-foreground whitespace-nowrap">ClinicOS</span>
            )}
          </div>
          <SidebarContent
            onNavClick={() => {}}
            isExpanded={isExpanded}
            pinned={pinned}
            onTogglePin={onTogglePin}
          />
        </aside>
      </div>
    </>
  );
}
