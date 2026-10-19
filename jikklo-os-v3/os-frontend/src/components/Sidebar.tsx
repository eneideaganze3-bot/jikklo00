import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

type NavItem = {
  label: string;
  path: string;
  permission: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", path: "/", permission: "dashboard.view" },
  { label: "Commandes", path: "/orders", permission: "orders.view" },
  { label: "Produits", path: "/products", permission: "products.view" },
  { label: "Catégories", path: "/categories", permission: "products.view" },
  { label: "Prix", path: "/pricing", permission: "pricing.view" },
  { label: "Stock", path: "/inventory", permission: "inventory.view" },
  { label: "Clients", path: "/customers", permission: "customers.view" },
  { label: "Jikklo Digital", path: "/digital", permission: "digital.view" },
  { label: "Fournisseurs", path: "/suppliers", permission: "suppliers.view" },
  { label: "Finance", path: "/finance", permission: "finance.view" },
  { label: "Publications", path: "/publications", permission: "publications.manage" },
  { label: "Paiements", path: "/payment-methods", permission: "payments.manage" },
  { label: "Rapports", path: "/reports", permission: "reports.view" },
  { label: "Journal d'audit", path: "/audit-logs", permission: "audit.view" },
  { label: "Utilisateurs", path: "/users", permission: "users.manage" },
  { label: "Paramètres", path: "/settings", permission: "settings.manage" },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { user, hasPermission, logout } = useAuth();
  const visibleItems = NAV_ITEMS.filter((item) => hasPermission(item.permission));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-jikklo-navy text-white flex flex-col
          transform transition-transform lg:translate-x-0
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="px-5 py-6 border-b border-white/10">
          <div className="font-bold text-lg tracking-tight">JIKKLO</div>
          <div className="text-xs text-white/50">Jikklo Operating System</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                `block px-5 py-2.5 text-sm transition-colors ${
                  isActive
                    ? "bg-jikklo-accent/20 text-jikklo-accent border-r-2 border-jikklo-accent"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="px-5 py-4 border-t border-white/10 space-y-3">
          <div className="text-sm font-medium truncate">{user?.fullName}</div>
          <div className="text-xs text-white/50 truncate">{user?.roleName}</div>
          <div className="flex items-center justify-between pt-1">
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-xs text-white/60 hover:text-white underline"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
