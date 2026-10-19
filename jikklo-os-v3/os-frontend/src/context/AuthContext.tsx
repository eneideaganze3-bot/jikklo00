import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "../api/client";

type AuthUser = {
  id: string;
  fullName: string;
  email: string;
  roleId: string;
  roleName: string;
  permissions: string[];
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (code: string) => boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // V2 : plus de vérification de token local — on demande simplement à
  // l'API si le cookie de session (envoyé automatiquement) est valide.
  useEffect(() => {
    api
      .get<{ user: AuthUser }>("/api/auth/me")
      .then((res) => setUser(res.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    await api.post("/api/auth/login", { email, password });
    const meRes = await api.get<{ user: AuthUser }>("/api/auth/me");
    setUser(meRes.user);
  }

  function logout() {
    api.post("/api/auth/logout").catch(() => {});
    setUser(null);
  }

  function hasPermission(code: string): boolean {
    return user?.permissions.includes(code) ?? false;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider");
  return ctx;
}
