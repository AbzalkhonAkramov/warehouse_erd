import { api } from "./client";
import type {
  ActivityEntry,
  AgentSalesRow,
  Category,
  CommissionRow,
  Customer,
  DashboardData,
  DebtRow,
  Invoice,
  InvoiceDetail,
  Payment,
  PaymentMethod,
  PhotoReport,
  Product,
  ProductHistoryEntry,
  SalesOrder,
  SalesOrderStatus,
  StockRow,
  TelegramTopic,
  TelegramUpdateHint,
  User,
} from "./types";

// --- Auth ---
export async function login(email: string, password: string): Promise<string> {
  const data = await api<{ access_token: string }>("/auth/login", {
    method: "POST",
    form: true,
    body: { username: email, password },
  });
  return data.access_token;
}

export const getMe = () => api<User>("/auth/me");

export const register = (body: {
  full_name: string;
  email: string;
  password: string;
  phone?: string;
}) => api<User>("/auth/register", { method: "POST", body });

export const changePassword = (current_password: string, new_password: string) =>
  api<unknown>("/auth/change-password", {
    method: "POST",
    body: { current_password, new_password },
  });

export const forgotPassword = (email: string) =>
  api<unknown>("/auth/forgot-password", { method: "POST", body: { email } });

// --- Users ---
export const listUsers = (role?: string) =>
  api<User[]>(`/users${role ? `?role=${role}` : ""}`);
export const updateUser = (id: number, body: Partial<User>) =>
  api<User>(`/users/${id}`, { method: "PATCH", body });
export const resetUserPassword = (id: number, password: string) =>
  api<User>(`/users/${id}`, { method: "PATCH", body: { password } });

// --- Categories & agent visibility ---
export const listCategories = () => api<Category[]>("/categories");
export const createCategory = (name: string) =>
  api<Category>("/categories", { method: "POST", body: { name } });
export const getAgentCategories = (agentId: number) =>
  api<Category[]>(`/users/${agentId}/categories`);
export const setAgentCategories = (agentId: number, category_ids: number[]) =>
  api<Category[]>(`/users/${agentId}/categories`, {
    method: "PUT",
    body: { category_ids },
  });

// --- Products & stock ---
export const listProducts = () => api<Product[]>("/products");
export const getProduct = (id: number) => api<Product>(`/products/${id}`);
export const createProduct = (body: Partial<Product>) =>
  api<Product>("/products", { method: "POST", body });
export const updateProduct = (id: number, body: Partial<Product>) =>
  api<Product>(`/products/${id}`, { method: "PATCH", body });
export const uploadProductImage = (id: number, file: File, side: "front" | "back" = "front") => {
  const form = new FormData();
  form.append("file", file);
  form.append("side", side);
  return api<Product>(`/products/${id}/image`, { method: "POST", body: form });
};
export const getProductHistory = (id: number) =>
  api<ProductHistoryEntry[]>(`/products/${id}/history`);
export const listStock = (lowOnly = false) =>
  api<StockRow[]>(`/inventory/stock${lowOnly ? "?low_only=true" : ""}`);
export const addStock = (product_id: number, quantity: string, note?: string) =>
  api<{ product_id: number; quantity: number }>("/inventory/adjust", {
    method: "POST",
    body: { product_id, quantity, type: "receipt", note },
  });

// --- Customers ---
export const listCustomers = () => api<Customer[]>("/customers");
export const createCustomer = (body: Partial<Customer>) =>
  api<Customer>("/customers", { method: "POST", body });
export const updateCustomer = (id: number, body: Partial<Customer>) =>
  api<Customer>(`/customers/${id}`, { method: "PATCH", body });

// --- Sales orders ---
export const listOrders = (status?: SalesOrderStatus) =>
  api<SalesOrder[]>(`/sales-orders${status ? `?status_filter=${status}` : ""}`);
export const approveOrder = (id: number) =>
  api<SalesOrder>(`/sales-orders/${id}/approve`, { method: "POST" });
export const rejectOrder = (id: number, reason: string) =>
  api<SalesOrder>(`/sales-orders/${id}/reject`, { method: "POST", body: { reason } });
export const pickOrder = (id: number) =>
  api<SalesOrder>(`/sales-orders/${id}/pick`, { method: "POST" });
export const deliverOrder = (id: number) =>
  api<SalesOrder>(`/sales-orders/${id}/deliver`, { method: "POST" });

// --- Finance ---
export const listInvoices = () => api<Invoice[]>("/invoices");
export const getInvoice = (id: number) => api<InvoiceDetail>(`/invoices/${id}`);
export const recordPayment = (invoice_id: number, amount: string, method: PaymentMethod) =>
  api<unknown>("/payments", { method: "POST", body: { invoice_id, amount, method } });
export const uploadPaymentImage = (paymentId: number, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<Payment>(`/payments/${paymentId}/image`, { method: "POST", body: form });
};

// --- Activity log (super-admin) ---
export const listActivity = (params: {
  user_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
}) => {
  const q = new URLSearchParams();
  if (params.user_id) q.set("user_id", String(params.user_id));
  if (params.date_from) q.set("date_from", params.date_from);
  if (params.date_to) q.set("date_to", params.date_to);
  if (params.search) q.set("search", params.search);
  const qs = q.toString();
  return api<ActivityEntry[]>(`/activity${qs ? `?${qs}` : ""}`);
};

// --- Reports ---
export const getDashboard = () => api<DashboardData>("/reports/dashboard");
export const salesByAgent = () => api<AgentSalesRow[]>("/reports/sales-by-agent");
export const debtAging = () => api<DebtRow[]>("/reports/debt-aging");
export const commissions = (year: number, month: number) =>
  api<CommissionRow[]>(`/reports/commissions?year=${year}&month=${month}`);

// --- Telegram topics (super-admin) ---
export const listTopics = () => api<TelegramTopic[]>("/telegram-topics");
export const createTopic = (body: Partial<TelegramTopic>) =>
  api<TelegramTopic>("/telegram-topics", { method: "POST", body });
export const updateTopic = (id: number, body: Partial<TelegramTopic>) =>
  api<TelegramTopic>(`/telegram-topics/${id}`, { method: "PATCH", body });
export const discoverUpdates = () =>
  api<TelegramUpdateHint[]>("/telegram-topics/updates");

// --- Photo reports ---
export const listPhotoReports = () => api<PhotoReport[]>("/photo-reports");
export const resendPhotoReport = (id: number) =>
  api<PhotoReport>(`/photo-reports/${id}/resend`, { method: "POST" });

/** URL for a stored photo (served by the backend at /uploads/<path>). */
export const uploadUrl = (path: string) => `/uploads/${path}`;
