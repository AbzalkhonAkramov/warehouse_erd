import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import OrdersPage from "./pages/OrdersPage";
import CreateOrderPage from "./pages/CreateOrderPage";
import OrderHistoryPage from "./pages/OrderHistoryPage";
import ReceiptPage from "./pages/ReceiptPage";
import RefundedGoodsPage from "./pages/RefundedGoodsPage";
import StatusHistoryPage from "./pages/StatusHistoryPage";
import ProductsPage from "./pages/ProductsPage";
import CustomersPage from "./pages/CustomersPage";
import CustomerDetailPage from "./pages/CustomerDetailPage";
import InvoicesPage from "./pages/InvoicesPage";
import InvoiceDetailPage from "./pages/InvoiceDetailPage";
import ReportsPage from "./pages/ReportsPage";
import PhotoReportsPage from "./pages/PhotoReportsPage";
import TopicsPage from "./pages/TopicsPage";
import AgentsPage from "./pages/AgentsPage";
import CreatePage from "./pages/CreatePage";
import ProductDetailPage from "./pages/ProductDetailPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import AccountsPage from "./pages/AccountsPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import BrandingPage from "./pages/BrandingPage";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="centered-screen">
        <Spinner />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Agents don't get the dashboard/reports — they land on their own invoices.
  const isAgent = user.role === "agent";

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={isAgent ? <Navigate to="/invoices" replace /> : <DashboardPage />}
        />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="orders/new" element={<CreateOrderPage />} />
        <Route
          path="orders/:id/history"
          element={isAgent ? <Navigate to="/orders" replace /> : <OrderHistoryPage />}
        />
        <Route path="orders/:id/receipt" element={<ReceiptPage />} />
        <Route
          path="refunds"
          element={isAgent ? <Navigate to="/orders" replace /> : <RefundedGoodsPage />}
        />
        <Route
          path="order-history"
          element={isAgent ? <Navigate to="/orders" replace /> : <StatusHistoryPage />}
        />
        <Route path="create" element={<CreatePage />} />
        <Route path="products" element={<ProductsPage />} />
        <Route path="products/:id" element={<ProductDetailPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoiceDetailPage />} />
        <Route path="photos" element={<PhotoReportsPage />} />
        <Route
          path="reports"
          element={isAgent ? <Navigate to="/invoices" replace /> : <ReportsPage />}
        />
        <Route path="accounts" element={<AccountsPage />} />
        <Route path="activity" element={<ActivityLogPage />} />
        <Route path="branding" element={<BrandingPage />} />
        <Route path="topics" element={<TopicsPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
