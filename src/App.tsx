import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/context/AppContext";
import PermissionsGate from "@/components/PermissionsGate";

import SignupPage from "./pages/SignupPage";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ProfilePage from "./pages/ProfilePage";
import PackagesPage from "./pages/PackagesPage";
import PaymentPage from "./pages/PaymentPage";

// User Pages
import DashboardPage from "./pages/DashboardPage";
import Transactions from "./pages/Transactions";
import AdminRechargesPage from "./pages/AdminRechargesPage";

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
import TradeHistory from "./pages/userSIdebar/TradeHistory";
import AffiliateProgramPage from "./pages/userSIdebar/AffiliateProgramPage";
import AffiliateRulesAdminPage from "./pages/AffiliateRulesAdminPage";
import AdminReferralsPage from "./pages/AdminReferralsPage";
import AdminWalletLedgerPage from "./pages/AdminWalletLedgerPage";
import AdminRoute from "./components/auth/AdminRoute";
import UserRoute from "./components/auth/UserRoute";
import My_Profile from "./pages/userSIdebar/My_Profile";
import WithdrawPage from "./pages/userSIdebar/WithdrawPage";
import AdminProfilePage from "./pages/AdminProfilePage";
import AdminUserProfilePage from "./pages/AdminUserProfilePage";
import AdminUserTradesPage from "./pages/AdminUserTradesPage";
import AdminWithdrawalsPage from "./pages/AdminWithdrawalsPage";
import SupportTicketsPage from "./pages/userSIdebar/SupportTicketsPage";
import AdminSupportTicketsPage from "./pages/AdminSupportTicketsPage";
import AdminUserMapPage from "./pages/AdminUserMapPage";
import AdminMaintenancePage from "./pages/AdminMaintenancePage";
import AdminNotificationsPage from "./pages/AdminNotificationsPage";
import AdminInvoicesPage from "./pages/AdminInvoicesPage";
import AdminPackagesPage from "./pages/AdminPackagesPage";
import AdminCouponsPage from "./pages/AdminCouponsPage";
import AdminFinancialStatsPage from "./pages/AdminFinancialStatsPage";
import UserNotificationsPage from "./pages/userSIdebar/UserNotificationsPage";
import UserInvoicesPage from "./pages/userSIdebar/UserInvoicesPage";
import LandingPage from "./pages/LandingPage";
import PostSignupOnboardingPage from "./pages/PostSignupOnboardingPage";
import RequiredSetupPage from "./pages/RequiredSetupPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AppProvider>
        <BrowserRouter>
          <PermissionsGate>
          <Routes>

            {/* Landing */}
            <Route path="/" element={<LandingPage />} />

            {/* Auth */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Public/User pages */}
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/packages" element={<PackagesPage />} />
            <Route path="/payment" element={<PaymentPage />} />

            {/* ✅ USER ROUTES (Nested with Outlet) */} 
            <Route
              path="/user"
              element={
                <UserRoute>
                  <UserLayout />
                </UserRoute>
              }
            >

              {/* Default → /user/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="my-trades" element={<Mytrades />} />
              <Route path="pnl" element={<ProfitLoss />} />
              <Route path="transactions" element={<Transactionspage />} />
              <Route path="trade-history" element={<TradeHistory />} />
              <Route path="recharge" element={<RechargePage />} />
              <Route path="withdraw" element={<WithdrawPage />} />
              <Route path="post-signup" element={<PostSignupOnboardingPage />} />
              <Route path="required-setup" element={<RequiredSetupPage />} />
              <Route path="affiliate" element={<AffiliateProgramPage />} />
              <Route path="notifications" element={<UserNotificationsPage />} />
              <Route path="invoices" element={<UserInvoicesPage />} />
              <Route path="profile" element={<My_Profile />} />
              <Route path="support" element={<SupportTicketsPage />} />

            </Route>

            {/* ✅ ADMIN ROUTES (Nested) */}
            <Route path="/admin" element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
              }>

              {/* Default → /admin/dashboard */}
              <Route index element={<Navigate to="dashboard" replace />} />

              <Route path="dashboard" element={<Dashboard />} />
              <Route path="profile" element={<AdminProfilePage />} />
              <Route path="open-trades" element={<OpenTrades />} />
              <Route path="users" element={<AdminPage />} />
              <Route path="users/:userId/trades" element={<AdminUserTradesPage />} />
              <Route path="user-map" element={<AdminUserMapPage />} />
              <Route path="user-profile/:userId" element={<AdminUserProfilePage />} />
              <Route path="transactions" element={<Transactions />} />
              <Route path="recharge" element={<AdminRechargesPage />} />
              <Route path="affiliate-rules" element={<AffiliateRulesAdminPage />} />
              <Route path="referrals" element={<AdminReferralsPage />} />
              <Route path="wallet-ledger" element={<AdminWalletLedgerPage />} />
              <Route path="financial-stats" element={<AdminFinancialStatsPage />} />
              <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
              <Route path="support-tickets" element={<AdminSupportTicketsPage />} />
              <Route path="maintenance" element={<AdminMaintenancePage />} />
              <Route path="notifications" element={<AdminNotificationsPage />} />
              <Route path="invoices" element={<AdminInvoicesPage />} />
              <Route path="packages" element={<AdminPackagesPage />} />
              <Route path="coupons" element={<AdminCouponsPage />} />

            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />

          </Routes>
          </PermissionsGate>
        </BrowserRouter>
      </AppProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;