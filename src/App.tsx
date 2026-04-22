import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Inventory from "@/pages/Inventory";
import Customers from "@/pages/Customers";
import CreditSales from "@/pages/CreditSales";
import Reports from "@/pages/Reports";
import AdminPanel from "@/pages/AdminPanel";
import Auth from "@/pages/Auth";
import NotFound from "./pages/NotFound";
import TransactionView from "@/pages/TransactionView";
import HrPayroll from "@/pages/HrPayroll";
import Finance from "@/pages/Finance";
import Procurement from "@/pages/Procurement";
import Branches from "@/pages/Branches";
import Audit from "@/pages/Audit";
import Copilot from "@/pages/Copilot";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

type AppRole =
  | "admin"
  | "cashier"
  | "inventory_manager"
  | "hr_admin"
  | "payroll_officer"
  | "manager"
  | "employee"
  | "finance_manager"
  | "auditor"
  | "branch_manager"
  | "procurement"
  | "user";

function ProtectedRoute({
  children,
  roles: allowedRoles,
  requireFullAccess,
}: {
  children: React.ReactNode;
  roles?: AppRole[];
  requireFullAccess?: boolean;
}) {
  const { session, loading, roles, accessLevel } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  if (!session) return <Navigate to="/auth" replace />;
  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r as any)))
    return <Navigate to="/" replace />;
  if (requireFullAccess && accessLevel === "partial") return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
    <Route path="/pos" element={<ProtectedRoute roles={["admin", "cashier"]}><AppLayout><POS /></AppLayout></ProtectedRoute>} />
    <Route path="/inventory" element={<ProtectedRoute roles={["admin", "inventory_manager", "procurement"]}><AppLayout><Inventory /></AppLayout></ProtectedRoute>} />
    <Route path="/customers" element={<ProtectedRoute roles={["admin", "cashier"]}><AppLayout><Customers /></AppLayout></ProtectedRoute>} />
    <Route path="/credit" element={<ProtectedRoute roles={["admin", "cashier"]} requireFullAccess><AppLayout><CreditSales /></AppLayout></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute roles={["admin", "manager", "finance_manager"]} requireFullAccess><AppLayout><Reports /></AppLayout></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute roles={["admin"]}><AppLayout><AdminPanel /></AppLayout></ProtectedRoute>} />
    <Route path="/hr" element={<ProtectedRoute><AppLayout><HrPayroll /></AppLayout></ProtectedRoute>} />
    <Route path="/finance" element={<ProtectedRoute roles={["admin", "finance_manager", "auditor"]}><AppLayout><Finance /></AppLayout></ProtectedRoute>} />
    <Route path="/procurement" element={<ProtectedRoute roles={["admin", "procurement", "inventory_manager"]}><AppLayout><Procurement /></AppLayout></ProtectedRoute>} />
    <Route path="/branches" element={<ProtectedRoute roles={["admin", "hr_admin", "manager"]}><AppLayout><Branches /></AppLayout></ProtectedRoute>} />
    <Route path="/audit" element={<ProtectedRoute roles={["admin", "auditor"]}><AppLayout><Audit /></AppLayout></ProtectedRoute>} />
    <Route path="/copilot" element={<ProtectedRoute><AppLayout><Copilot /></AppLayout></ProtectedRoute>} />
    <Route path="/receipt/:receiptId" element={<TransactionView />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CurrencyProvider>
            <AppRoutes />
          </CurrencyProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
