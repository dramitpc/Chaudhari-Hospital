import { ReactNode, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu, Stethoscope } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar — hidden on md+ */}
        <header className="md:hidden sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 px-4 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-foreground hover:text-primary transition-colors p-1 -ml-1 rounded"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm tracking-tight">ClinicOS</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
