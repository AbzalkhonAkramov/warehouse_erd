import { api, downloadFile } from "./client";
import type {
  ActivityEntry,
  Analytics,
  AgentSalesRow,
  PurchaseOrder,
  PurchaseOrderStatus,
  Supplier,
  ReturnRequest,
  Category,
  CommissionRow,
  Company,
  Currency,
  Customer,
  DashboardData,
  DebtRow,
  PhotoReport,
  Product,
  ProductHistoryEntry,
  Region,
  SalesOrder,
  SalesOrderStatus,
  RefundEntry,
  OrderStatusHistory,
  StockRow,
  StockCountDetail,
  StockCountSummary,
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

// --- Currencies (money types) — read for all, write is admin-only ---
export const listCurrencies = (activeOnly = false) =>
  api<Currency[]>(`/currencies${activeOnly ? "?active_only=true" : ""}`);
export const createCurrency = (body: Partial<Currency>) =>
  api<Currency>("/currencies", { method: "POST", body });
export const updateCurrency = (id: number, body: Partial<Currency>) =>
  api<Currency>(`/currencies/${id}`, { method: "PATCH", body });
export const deleteCurrency = (id: number) =>
  api<void>(`/currencies/${id}`, { method: "DELETE" });

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
// --- Inventory counts (stocktaking) ---
export const listStockCounts = () =>
  api<StockCountSummary[]>("/inventory/counts");
export const getStockCount = (id: number) =>
  api<StockCountDetail>(`/inventory/counts/${id}`);
export const startStockCount = (opts?: { note?: string | null; draft?: boolean }) =>
  api<StockCountDetail>("/inventory/counts", {
    method: "POST",
    body: { note: opts?.note ?? null, draft: opts?.draft ?? false },
  });
export interface StockCountLineIn {
  product_id: number;
  counted_qty: string | null;
}
export const saveStockCountLines = (id: number, lines: StockCountLineIn[]) =>
  api<StockCountDetail>(`/inventory/counts/${id}/lines`, {
    method: "PUT",
    body: { lines },
  });
export const completeStockCount = (
  id: number,
  opts: { lines: StockCountLineIn[]; apply: boolean; exclude_product_ids: number[] },
) =>
  api<StockCountDetail>(`/inventory/counts/${id}/complete`, {
    method: "POST",
    body: opts,
  });
export const cancelStockCount = (id: number) =>
  api<StockCountDetail>(`/inventory/counts/${id}/cancel`, { method: "POST" });

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

// --- Excel bulk-create (template download + import) ---
export interface BulkImportResult {
  created: number;
  skipped: number;
  errors: string[];
}
const importXlsx = (path: string, file: File) => {
  const form = new FormData();
  form.append("file", file);
  return api<BulkImportResult>(path, { method: "POST", body: form });
};
export const downloadProductsTemplate = () =>
  downloadFile("/products/template", "products-template.xlsx");
export const importProducts = (file: File) => importXlsx("/products/import", file);
export const downloadCategoriesTemplate = () =>
  downloadFile("/categories/template", "categories-template.xlsx");
export const importCategories = (file: File) => importXlsx("/categories/import", file);
export const downloadMarketsTemplate = () =>
  downloadFile("/customers/template", "markets-template.xlsx");
export const importMarkets = (file: File) => importXlsx("/customers/import", file);

// --- Customers ---
export interface CustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  city?: string;
  visit_days?: string | null;
  credit_limit?: string;
  /** Market debt — set manually by the manager. */
  debt?: string;
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
  note?: string;
  lines: OrderLineInput[];
}
export interface UpdateOrderInput {
  deliverer?: string;
  deliverer_id?: number;
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
export const updateCompany = (body: {
  name?: string;
  display_mode?: string;
  excel_lang?: string;
}) => api<Company>("/meta/company", { method: "PATCH", body });

// --- Product returns (agent submits, manager approves) ---
export const listReturns = (status?: string) =>
  api<ReturnRequest[]>(`/returns${status ? `?status_filter=${status}` : ""}`);
export const createReturn = (body: {
  // By order: sales_order_id. By market+SKU: customer_id + agent_id.
  sales_order_id?: number;
  customer_id?: number;
  agent_id?: number | null;
  lines: { product_id: number; quantity: string }[];
  restock: boolean;
  note?: string | null;
}) => api<ReturnRequest>("/returns", { method: "POST", body });
export const approveReturn = (id: number, restock: boolean) =>
  api<ReturnRequest>(`/returns/${id}/approve`, { method: "POST", body: { restock } });
export const rejectReturn = (id: number) =>
  api<ReturnRequest>(`/returns/${id}/reject`, { method: "POST" });

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
export const archiveOrder = (id: number) =>
  api<SalesOrder>(`/sales-orders/${id}/archive`, { method: "POST" });
export const unarchiveOrder = (id: number) =>
  api<SalesOrder>(`/sales-orders/${id}/unarchive`, { method: "POST" });
export const bulkMoveOrders = (ids: number[], status: SalesOrderStatus) =>
  api<{ moved: number; failed: Record<number, string> }>("/sales-orders/bulk-move", {
    method: "POST",
    body: { ids, status },
  });
// Receipt downloads (.xlsx, 2 copies side by side, landscape).
export const downloadReceipt = (id: number, orderNo?: string) =>
  downloadFile(`/sales-orders/${id}/receipt.xlsx`, `receipt-${orderNo ?? id}.xlsx`);
export const downloadReceiptsBulk = (ids: number[]) =>
  downloadFile(`/sales-orders/receipts.xlsx?ids=${ids.join(",")}`, "receipts.xlsx");

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
export const getAnalytics = (from?: string, to?: string, group: "day" | "month" = "day") => {
  const p = new URLSearchParams({ group });
  if (from) p.set("date_from", from);
  if (to) p.set("date_to", to);
  return api<Analytics>(`/reports/analytics?${p.toString()}`);
};

// --- Suppliers & purchasing (incoming goods) ---
export const listSuppliers = () => api<Supplier[]>("/suppliers");
export const createSupplier = (body: {
  code: string;
  name: string;
  phone?: string | null;
}) => api<Supplier>("/suppliers", { method: "POST", body });
export const listPurchaseOrders = (status?: PurchaseOrderStatus) =>
  api<PurchaseOrder[]>(`/purchase-orders${status ? `?status_filter=${status}` : ""}`);
export const createPurchaseOrder = (body: {
  supplier_id?: number | null;
  expected_date?: string | null;
  note?: string | null;
  draft?: boolean;
  lines: { product_id: number; quantity: string; unit_cost: string }[];
}) => api<PurchaseOrder>("/purchase-orders", { method: "POST", body });
export const receivePurchaseOrder = (id: number) =>
  api<PurchaseOrder>(`/purchase-orders/${id}/receive`, { method: "POST", body: { lines: [] } });
export const downloadIncomingTemplate = (categoryIds?: number[]) => {
  const qs = (categoryIds ?? [])
    .map((id) => `category_id=${encodeURIComponent(id)}`)
    .join("&");
  return downloadFile(
    `/purchase-orders/template${qs ? `?${qs}` : ""}`,
    "incoming-template.xlsx",
  );
};
export const importIncoming = (file: File) => importXlsx("/purchase-orders/import", file);

// --- Telegram topics (super-admin) ---
export const listTopics = () => api<TelegramTopic[]>("/telegram-topics");
export const createTopic = (body: Partial<TelegramTopic>) =>
  api<TelegramTopic>("/telegram-topics", { method: "POST", body });
export const updateTopic = (id: number, body: Partial<TelegramTopic>) =>
  api<TelegramTopic>(`/telegram-topics/${id}`, { method: "PATCH", body });
export const deleteTopic = (id: number) =>
  api<void>(`/telegram-topics/${id}`, { method: "DELETE" });
export const discoverUpdates = () =>
  api<TelegramUpdateHint[]>("/telegram-topics/updates");

// --- Telegram user linking (super-admin) ---
export interface TelegramBotInfo {
  configured: boolean;
  username?: string | null;
  error?: string | null;
}
export interface TelegramLinkUser {
  id: number;
  full_name: string;
  email: string;
  role: string;
  linked: boolean;
  telegram_username?: string | null;
  has_code: boolean;
}
export interface TelegramLinkCode {
  code: string;
  link?: string | null;
}
export interface TelegramSyncResult {
  checked: number;
  linked: string[];
}
export const getTelegramBot = () => api<TelegramBotInfo>("/telegram/users/bot");
export const listTelegramUsers = () =>
  api<TelegramLinkUser[]>("/telegram/users");
export const generateTelegramCode = (id: number) =>
  api<TelegramLinkCode>(`/telegram/users/${id}/code`, { method: "POST" });
export const unlinkTelegramUser = (id: number) =>
  api<TelegramLinkUser>(`/telegram/users/${id}/unlink`, { method: "POST" });
export const syncTelegramLinks = () =>
  api<TelegramSyncResult>("/telegram/users/sync", { method: "POST" });

// --- Photo reports ---
export interface PhotoFilters {
  customer_id?: number;
  agent_id?: number;
  topic_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
}
export const listPhotoReports = (filters: PhotoFilters = {}) => {
  const p = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== "") p.set(k, String(v));
  });
  const qs = p.toString();
  return api<PhotoReport[]>(`/photo-reports${qs ? `?${qs}` : ""}`);
};
export const listPhotoTopics = () =>
  api<{ id: number; name: string }[]>("/photo-reports/topics");
export const resendPhotoReport = (id: number) =>
  api<PhotoReport>(`/photo-reports/${id}/resend`, { method: "POST" });

/** URL for a stored photo (served by the backend at /uploads/<path>). */
export const uploadUrl = (path: string) => `/uploads/${path}`;
