import { api, downloadFile } from "./client";
import type {
  ActivityEntry,
  AgentSalesRow,
  Category,
  CommissionRow,
  Company,
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
  Region,
  SalesOrder,
  SalesOrderStatus,
  RefundEntry,
  OrderStatusHistory,
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

// --- Agent photo-topic visibility (admin) ---
export interface AgentTopic {
  id: number;
  name: string;
}
export const getAgentTopics = (agentId: number) =>
  api<AgentTopic[]>(`/users/${agentId}/topics`);
export const setAgentTopics = (agentId: number, topic_ids: number[]) =>
  api<AgentTopic[]>(`/users/${agentId}/topics`, {
    method: "PUT",
    body: { topic_ids },
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
export interface StockImportResult {
  updated: number;
  added_total: string;
  skipped: number;
  errors: string[];
}
export const downloadStockTemplate = () =>
  downloadFile("/inventory/stock-template", "stock-template.xlsx");
export const importStock = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<StockImportResult>("/inventory/stock-import", { method: "POST", body: form });
};
export const addStock = (product_id: number, quantity: string, note?: string) =>
  api<{ product_id: number; quantity: number }>("/inventory/adjust", {
    method: "POST",
    body: { product_id, quantity, type: "receipt", note },
  });

// --- Customers ---
export interface CustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  credit_limit?: string;
  region_id?: number | null;
  agent_ids?: number[];
}
export const listCustomers = () => api<Customer[]>("/customers");
export const getCustomer = (id: number) => api<Customer>(`/customers/${id}`);
export const createCustomer = (body: CustomerInput) =>
  api<Customer>("/customers", { method: "POST", body });
export const updateCustomer = (id: number, body: CustomerInput) =>
  api<Customer>(`/customers/${id}`, { method: "PATCH", body });
// Manager assigns a set of shops to an agent (like categories).
export const setAgentShops = (agentId: number, customer_ids: number[]) =>
  api<Customer[]>(`/customers/agent-shops/${agentId}`, {
    method: "PUT",
    body: { customer_ids },
  });

// --- Regions ---
export const listRegions = () => api<Region[]>("/regions");
export const createRegion = (name: string) =>
  api<Region>("/regions", { method: "POST", body: { name } });

// --- Sales orders ---
export interface OrderLineInput {
  product_id: number;
  quantity: string;
  unit_price?: string;
}
export interface CreateOrderInput {
  customer_id: number;
  agent_id?: number;
  discount?: string;
  note?: string;
  lines: OrderLineInput[];
}
export interface UpdateOrderInput {
  deliverer?: string;
  note?: string;
  photo_required?: boolean;
}

export interface MoveLineInput {
  product_id: number;
  quantity: string;
}
export interface MoveInput {
  status: SalesOrderStatus;
  lines?: MoveLineInput[]; // omitted = whole order
  restock?: boolean; // only for refund
  note?: string;
}
export interface RefundFilters {
  customer_id?: number;
  agent_id?: number;
  product_id?: number;
  restocked?: boolean;
  date_from?: string;
  date_to?: string;
}

export const getCompany = () => api<Company>("/meta/company");
export const updateCompany = (body: { name?: string; display_mode?: string }) =>
  api<Company>("/meta/company", { method: "PATCH", body });
export const uploadCompanyLogo = (file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<Company>("/meta/company/logo", { method: "POST", body: form });
};
export const deleteCompanyLogo = () =>
  api<Company>("/meta/company/logo", { method: "DELETE" });
export const getOrder = (id: number) => api<SalesOrder>(`/sales-orders/${id}`);
export const listOrders = (status?: SalesOrderStatus, archived = false) => {
  const p = new URLSearchParams();
  if (status) p.set("status_filter", status);
  if (archived) p.set("archived", "true");
  const qs = p.toString();
  return api<SalesOrder[]>(`/sales-orders${qs ? `?${qs}` : ""}`);
};
export const createOrder = (body: CreateOrderInput) =>
  api<SalesOrder>("/sales-orders", { method: "POST", body });
export const updateOrder = (id: number, body: UpdateOrderInput) =>
  api<SalesOrder>(`/sales-orders/${id}`, { method: "PATCH", body });
export const moveOrder = (id: number, body: MoveInput) =>
  api<SalesOrder>(`/sales-orders/${id}/move`, { method: "POST", body });

export const listRefunds = (filters: RefundFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const qs = p.toString();
  return api<RefundEntry[]>(`/sales-orders/refunds${qs ? `?${qs}` : ""}`);
};
export const listStatusHistory = (orderId?: number, tree = false) => {
  const p = new URLSearchParams();
  if (orderId) p.set("order_id", String(orderId));
  if (tree) p.set("tree", "true");
  const qs = p.toString();
  return api<OrderStatusHistory[]>(`/sales-orders/status-history${qs ? `?${qs}` : ""}`);
};

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
