import { ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Spinner } from "@/components/ui/spinner";
import { UserRole } from "@workspace/api-client-react";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-center p-4">
        <h1 className="text-3xl font-bold text-destructive mb-2">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You do not have permission to view this page.</p>
        <button 
          onClick={() => setLocation("/dashboard")}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
