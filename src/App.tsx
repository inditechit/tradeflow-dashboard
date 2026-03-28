import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";

import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import PackagesPage from "./pages/PackagesPage";
import PaymentPage from "./pages/PaymentPage";

// User Pages
import DashboardPage from "./pages/DashboardPage";
import Transactions from "./pages/Transactions";
import Recharge from "./pages/Recharge";

// Admin Pages
import Dashboard from "./pages/Dashboard";
import AdminPage from "./pages/AdminPage";
import OpenTrades from "./pages/OpenTrades";

import NotFound from "./pages/NotFound";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import UserLayout from "./layouts/UserLayout";
import Mytrades from "./pages/userSIdebar/Mytrades";
import ProfitLoss from "./pages/userSIdebar/ProfitLoss";
import Transactionspage from "./pages/userSIdebar/Transactionspage";
import RechargePage from "./pages/userSIdebar/RechargePage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <Routes>

            {/* Default */}
            <Route path="/" element={<Navigate to="/login" replace />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Public/User pages */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* ✅ USER ROUTES (Nested with Outlet) */} 
            <Route path="/user" element={<UserLayout />}>

              {/* Default → /user/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="my-trades" element={<Mytrades />} />
              <Route path="pnl" element={<ProfitLoss />} />
              <Route path="transactions" element={<Transactionspage />} />
              <Route path="recharge" element={<RechargePage />} />

            </Route>

            {/* ✅ ADMIN ROUTES (Nested) */}
            <Route path="/admin" element={<AdminLayout />}>

              {/* Default → /admin/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route path="dashboard" element={<Dashboard />} />
              <Route path="open-trades" element={<OpenTrades />} />
              <Route path="users" element={<AdminPage />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="recharge" element={<Recharge />} />

            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />

          </Routes>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;