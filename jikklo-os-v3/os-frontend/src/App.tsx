import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Products } from "./pages/Products";
import { Pricing } from "./pages/Pricing";
import { Inventory } from "./pages/Inventory";
import { Orders } from "./pages/Orders";
import { Customers } from "./pages/Customers";
import { Reports } from "./pages/Reports";
import { AuditLogs } from "./pages/AuditLogs";
import { Settings } from "./pages/Settings";
import { Users } from "./pages/Users";
import { Digital } from "./pages/Digital";
import { Suppliers } from "./pages/Suppliers";
import { Finance } from "./pages/Finance";
import { PaymentMethods } from "./pages/PaymentMethods";
import { Publications } from "./pages/Publications";
import { Categories } from "./pages/Categories";

export function App() {
  return (
    <ThemeProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute requiredPermission="dashboard.view">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <ProtectedRoute requiredPermission="orders.view">
                <Orders />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute requiredPermission="products.view">
                <Products />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pricing"
            element={
              <ProtectedRoute requiredPermission="pricing.view">
                <Pricing />
              </ProtectedRoute>
            }
          />
          <Route
            path="/inventory"
            element={
              <ProtectedRoute requiredPermission="inventory.view">
                <Inventory />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute requiredPermission="customers.view">
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/digital"
            element={
              <ProtectedRoute requiredPermission="digital.view">
                <Digital />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute requiredPermission="suppliers.view">
                <Suppliers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/finance"
            element={
              <ProtectedRoute requiredPermission="finance.view">
                <Finance />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute requiredPermission="reports.view">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute requiredPermission="audit.view">
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute requiredPermission="users.manage">
                <Users />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute requiredPermission="settings.manage">
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/categories"
            element={
              <ProtectedRoute requiredPermission="products.view">
                <Categories />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payment-methods"
            element={
              <ProtectedRoute requiredPermission="payments.manage">
                <PaymentMethods />
              </ProtectedRoute>
            }
          />
          <Route
            path="/publications"
            element={
              <ProtectedRoute requiredPermission="publications.manage">
                <Publications />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<ProtectedRoute><div>Page introuvable.</div></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ThemeProvider>
  );
}
