// Decimal fields are serialised as strings by the backend (Pydantic).
export type Money = string;

export type Role =
  | "admin"
  | "manager"
  | "agent"
  | "warehouse"
  | "accountant"
  | "deliverer";

export interface User {
  id: number;
  full_name: string;
  email: string;
  phone?: string | null;
  role: Role;
  is_active: boolean;
  reset_requested?: boolean;
  telegram_chat_id?: string | null;
  /** Admin "important" flag: this agent's orders need before/after photos. */
  photo_required?: boolean;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  barcode?: string | null;
  description?: string | null;
  unit: string;
  category_id?: number | null;
  cost_price: Money;
  sale_price: Money;
  min_stock: Money;
  is_active: boolean;
  image_path?: string | null;
  image_back_path?: string | null;
  on_hand?: Money | null;
}

export interface ActivityEntry {
  id: number;
  user_id: number | null;
  user_name: string | null;
  method: string;
  path: string;
  action: string;
  detail?: string | null;
  status_code: number;
  created_at: string;
}

export interface StockRow {
  product_id: number;
  product_name: string;
  sku: string;
  warehouse_id: number;
  quantity: Money;
  min_stock: Money;
  low: boolean;
}

export interface AgentBrief {
  id: number;
  full_name: string;
}

export interface Region {
  id: number;
  name: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  visit_days?: string | null;
  latitude?: Money | null;
  longitude?: Money | null;
  credit_limit: Money;
  debt: Money;
  region_id?: number | null;
  region_name?: string | null;
  agents?: AgentBrief[];
  agent_ids?: number[];
}

export type SalesOrderStatus =
  | "new"
  | "shipped"
  | "delivered"
  | "refund"
  | "cancelled";

export interface SalesOrderLine {
  id: number;
  product_id: number;
  product_name?: string | null;
  quantity: Money;
  unit_price: Money;
  line_total: Money;
  refunded_quantity: Money;
}

export interface Company {
  name: string;
  logo_url?: string | null;
  display_mode: "text" | "logo" | "both";
  cash_handover_mode?: "manager_records" | "agent_submits";
}

export interface ReturnLine {
  product_id: number;
  product_name?: string | null;
  quantity: Money;
}

export interface ReturnRequest {
  id: number;
  customer_id: number;
  customer_name?: string | null;
  sales_order_id: number;
  order_no?: string | null;
  agent_id?: number | null;
  agent_name?: string | null;
  status: "pending" | "approved" | "rejected";
  note?: string | null;
  created_at: string;
  lines: ReturnLine[];
}

export interface AgentCash {
  agent_id: number;
  agent_name: string;
  collected: Money;
  received: Money;
  pending: Money;
  outstanding: Money;
}

export interface CashRemittance {
  id: number;
  agent_id: number;
  agent_name?: string | null;
  amount: Money;
  status: "pending" | "received";
  note?: string | null;
  created_at: string;
  received_at?: string | null;
  received_by_name?: string | null;
}

export interface SalesOrder {
  id: number;
  order_no?: string | null;
  invoice_number?: string | null;
  customer_id: number;
  agent_id: number;
  agent_name?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  parent_order_id?: number | null;
  warehouse_id: number;
  status: SalesOrderStatus;
  subtotal: Money;
  discount: Money;
  total: Money;
  note?: string | null;
  deliverer?: string | null;
  deliverer_id?: number | null;
  archived: boolean;
  /** Manager per-order switch: require before/after photos for this order. */
  photo_required?: boolean;
  /** Whether this order's agent is flagged "important" (photos matter). */
  agent_photo_required?: boolean;
  /** Before/after photos pinned to the order (populated by getOrder). */
  photos?: OrderPhoto[];
  /** True once both before and after photos are pinned. */
  photo_complete?: boolean;
  approved_by_id?: number | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  lines: SalesOrderLine[];
}

export interface OrderPhoto {
  stage: string; // "before" | "after"
  /** Deep link to the Telegram message, or null if the send failed. */
  link: string | null;
}

export interface RefundEntry {
  id: number;
  sales_order_id: number;
  product_id: number;
  product_name?: string | null;
  customer_id: number;
  customer_name?: string | null;
  agent_id?: number | null;
  agent_name?: string | null;
  deliverer?: string | null;
  quantity: Money;
  unit_price: Money;
  value: Money;
  restocked: boolean;
  created_at: string;
}

export interface OrderStatusHistory {
  id: number;
  sales_order_id: number;
  order_no?: string | null;
  from_status?: string | null;
  to_status: string;
  kind?: string;
  detail?: string | null;
  related_order_id?: number | null;
  related_order_no?: string | null;
  changed_by_id?: number | null;
  changed_by_name?: string | null;
  created_at: string;
}

export type InvoiceStatus = "unpaid" | "partial" | "paid";

export interface Invoice {
  id: number;
  number: string;
  sales_order_id: number;
  customer_id: number;
  total: Money;
  paid_amount: Money;
  status: InvoiceStatus;
  created_at: string;
}

export interface Payment {
  id: number;
  invoice_id: number;
  amount: Money;
  method: PaymentMethod;
  collected_by_id: number | null;
  collected_by_name: string | null;
  collected_at: string;
  note: string | null;
  image_path: string | null;
}

export interface InvoiceDetail extends Invoice {
  payments: Payment[];
}

export interface DashboardData {
  pending_orders: number;
  stock_value: Money;
  total_debt: Money;
  low_stock_items: number;
}

export interface AgentSalesRow {
  agent_id: number;
  agent_name: string;
  orders: number;
  total: Money;
}

export interface CommissionRow {
  agent_id: number;
  agent_name: string;
  commission_rate: Money;
  sales_total: Money;
  commission: Money;
  target?: Money | null;
  achievement_pct?: number | null;
}

export interface DebtRow {
  customer_id: number;
  name: string;
  debt: number;
  credit_limit: number;
  over_limit: boolean;
}

export type PaymentMethod = "cash" | "transfer" | "card";

export interface Category {
  id: number;
  name: string;
}

export interface ProductHistoryEntry {
  kind: "added" | "sale";
  date: string;
  quantity: Money;
  user_name: string | null;
  detail: string | null;
}

export interface TelegramTopic {
  id: number;
  name: string;
  chat_id: number;
  message_thread_id: number | null;
  is_active: boolean;
  is_default: boolean;
}

export interface TelegramUpdateHint {
  chat_id: number | null;
  chat_title: string | null;
  chat_type: string | null;
  message_thread_id: number | null;
  topic_name: string | null;
  text: string | null;
}

export type PhotoStage = "before" | "after";
export type PhotoReportStatus = "pending" | "sent" | "failed";

export interface PhotoImage {
  id: number;
  stage: PhotoStage;
  /** Deep link to the Telegram message (images are stored in Telegram only). */
  telegram_link: string | null;
  telegram_message_id?: number | null;
}

export interface PhotoReport {
  id: number;
  agent_id: number;
  customer_id: number;
  sales_order_id: number | null;
  topic_id: number | null;
  note: string | null;
  status: PhotoReportStatus;
  error: string | null;
  created_at: string;
  images: PhotoImage[];
}
