import { useEffect } from "react";
import { useLocation } from "wouter";
import { isAdmin } from "@/lib/auth";

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAdmin()) {
      setLocation("/");
    }
  }, [setLocation]);

  if (!isAdmin()) {
    return null;
  }

  return <>{children}</>;
}
