import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Layout } from "./Layout";

export function ProtectedRoute({
  children,
  requiredPermission,
}: {
  children: ReactNode;
  requiredPermission?: string;
}) {
  const { user, loading, hasPermission } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400">
        Chargement…
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <Layout>
        <div className="text-center py-20 text-slate-500">
          Vous n'avez pas la permission d'accéder à cette page.
        </div>
      </Layout>
    );
  }

  return <Layout>{children}</Layout>;
}
