// Tailwind utility-class strings replacing the old styles.css classes.
// Pure utilities (no @apply / CSS component classes) — referenced from JSX to
// keep the migration DRY. Values mirror the previous design 1:1.

/** Join conditional class strings. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

// --- Layout ---
export const appShell = "flex min-h-screen";
export const sidebar =
  "w-60 bg-sidebar text-slate-300 shrink-0 py-[18px] px-3 " +
  "sticky top-0 self-start h-screen overflow-y-auto";
export const brand =
  "flex items-center gap-2.5 text-white px-3 pt-1 pb-[18px] min-w-0";
export const brandLogo = "h-7 w-7 rounded-md object-cover shrink-0 bg-white/10";
export const brandName = "font-bold text-base truncate";
export const navGroup = "mt-4 first:mt-1";
export const navGroupLabel =
  "px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500";
export const navLink =
  "flex items-center gap-2.5 py-2.5 px-3 rounded-lg text-slate-300 no-underline mb-0.5 font-medium " +
  "transition-colors duration-150 hover:bg-sidebar-active hover:text-white " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";
export const navLinkActive = "bg-brand text-white hover:bg-brand hover:text-white";
export const navIcon = "shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]";
export const main = "flex-1 flex flex-col min-w-0";
export const topbar =
  "h-[60px] bg-white border-b border-line flex items-center justify-between px-6 " +
  "sticky top-0 z-20";
export const topbarTitle = "text-[15px] font-semibold text-ink";
export const topbarUser = "flex items-center gap-3";
export const langSwitcher =
  "py-1.5 px-2 border border-line rounded-lg bg-white text-[13px] font-[inherit] cursor-pointer";
export const loginLang = "flex justify-end mb-3";
export const userName = "font-semibold";
export const userRole =
  "text-xs text-muted bg-appbg py-0.5 px-2 rounded-full capitalize";
export const content = "p-6";
/** The old `.page` had no styling — a plain semantic wrapper. */
export const page = "";
export const pageHead = "flex items-center justify-between mb-[18px]";
export const detailStats = "flex-1 mb-0";
export const h1 = "text-[22px] font-semibold m-0";

// --- Cards & stats ---
export const card =
  "rounded-card border border-line bg-white shadow-card p-[18px]";
export const cardTitle = "font-semibold text-[15px] mb-3.5";
export const statGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5";
export const statValue = "text-[28px] font-bold";
export const statLabel = "text-muted mt-1";
export const plainLink = "no-underline text-inherit block";

// --- Tables (styled via arbitrary child variants so markup stays clean) ---
export const table =
  "w-full border-collapse " +
  "[&_thead_th]:sticky [&_thead_th]:top-[60px] [&_thead_th]:z-10 [&_thead_th]:bg-white " +
  "[&_th]:text-left [&_th]:px-3 [&_th]:py-2.5 [&_th]:border-b [&_th]:border-line " +
  "[&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-muted [&_th]:font-semibold " +
  "[&_td]:text-left [&_td]:px-3 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-line " +
  "[&_tbody_tr]:transition-colors [&_tbody_tr:nth-child(even)>td]:bg-appbg/40 " +
  "[&_tbody_tr:last-child>td]:border-b-0";
export const tableSub =
  table + " !w-auto min-w-[420px] [&_thead_th]:!static [&_tbody_tr:nth-child(even)>td]:!bg-transparent";
export const confirmTable =
  table +
  " [&_thead_th]:!static [&_tbody_tr:nth-child(even)>td]:!bg-transparent " +
  "[&_th]:normal-case [&_th]:tracking-normal [&_th]:font-medium [&_th]:w-[42%] [&_th]:text-[13px]";
export const numCell = "text-right tabular-nums";
export const strong = "font-semibold";
export const warn = "text-red-700";
export const mono = "font-mono text-[13px]";
export const clickable =
  "cursor-pointer transition-colors [&:hover>td]:bg-brand/[0.04]";
export const actionsCol = "text-right whitespace-nowrap [&>*]:ml-1.5";
export const detailRowTd = "[&>td]:bg-gray-50";
export const orderDetail = "py-1.5 px-1";
export const note = "text-muted mt-2";
export const noteWarn = "text-red-700 mt-2";

// --- Buttons ---
const btnBase =
  "inline-flex items-center gap-1.5 border border-transparent rounded-lg py-[7px] px-3.5 text-[13px] font-semibold cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed " +
  "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-1 active:translate-y-px";
export const btn: Record<string, string> = {
  primary: cx(btnBase, "bg-brand text-white hover:bg-brand-dark"),
  ghost: cx(btnBase, "bg-white text-ink !border-line hover:bg-appbg"),
  danger: cx(btnBase, "bg-red-600 text-white hover:bg-red-700"),
  success: cx(btnBase, "bg-green-600 text-white hover:bg-green-700"),
};

// --- Badges ---
const badgeBase =
  "inline-block py-[3px] px-[9px] rounded-full text-xs font-semibold capitalize";
export const badge: Record<string, string> = {
  green: cx(badgeBase, "bg-green-100 text-green-800"),
  red: cx(badgeBase, "bg-red-100 text-red-800"),
  amber: cx(badgeBase, "bg-amber-100 text-amber-800"),
  blue: cx(badgeBase, "bg-blue-100 text-blue-800"),
  violet: cx(badgeBase, "bg-violet-100 text-violet-800"),
  gray: cx(badgeBase, "bg-slate-100 text-slate-600"),
};

// --- Filters / chips / inputs ---
export const filterRow = "flex gap-2 mb-4 flex-wrap items-center";
export const chip =
  "h-9 border border-line bg-white rounded-full py-1.5 px-3.5 cursor-pointer text-[13px] font-medium " +
  "transition-colors duration-150 hover:border-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40";
export const chipActive = "!bg-brand !text-white !border-brand";
export const searchInput =
  "h-9 py-2 px-3 border border-line rounded-lg text-sm min-w-[240px] focus:outline-none focus:border-brand";
export const selectInput =
  "h-9 py-1.5 px-2 border border-line rounded-lg bg-white text-sm focus:outline-none focus:border-brand";
export const inlineField =
  "flex items-center gap-1.5 text-[13px] text-muted " +
  "[&_input]:py-1.5 [&_input]:px-2 [&_input]:border [&_input]:border-line [&_input]:rounded-md " +
  "[&_select]:py-1.5 [&_select]:px-2 [&_select]:border [&_select]:border-line [&_select]:rounded-md [&_select]:bg-white";
export const inlineCheck =
  "inline-flex items-center gap-1.5 text-[13px] cursor-pointer whitespace-nowrap";

// --- Forms ---
// Inputs/selects/textareas inside a `.field` are styled via child variants so
// call-sites only need the container class (mirrors the old `.field input {}`).
const fieldControl =
  "[&_input]:py-2.5 [&_input]:px-[11px] [&_input]:border [&_input]:border-line [&_input]:rounded-lg [&_input]:text-sm [&_input]:w-full [&_input]:min-w-0 [&_input]:box-border [&_input:focus]:outline-none [&_input:focus]:border-brand [&_input:focus]:ring-[3px] [&_input:focus]:ring-brand/15 " +
  "[&_select]:py-2.5 [&_select]:px-[11px] [&_select]:border [&_select]:border-line [&_select]:rounded-lg [&_select]:text-sm [&_select]:w-full [&_select]:min-w-0 [&_select]:box-border [&_select]:bg-white [&_select:focus]:outline-none [&_select:focus]:border-brand " +
  "[&_textarea]:py-2.5 [&_textarea]:px-[11px] [&_textarea]:border [&_textarea]:border-line [&_textarea]:rounded-lg [&_textarea]:text-sm [&_textarea]:w-full [&_textarea]:min-w-0 [&_textarea]:box-border [&_textarea:focus]:outline-none [&_textarea:focus]:border-brand";
export const field =
  "flex flex-col gap-1.5 mb-3.5 min-w-0 [&>span]:text-[13px] [&>span]:font-medium [&>span]:text-muted " +
  fieldControl;
export const fieldLabel = "text-[13px] font-medium text-muted";
export const input =
  "py-2.5 px-[11px] border border-line rounded-lg text-sm w-full min-w-0 box-border focus:outline-none focus:border-brand focus:ring-[3px] focus:ring-brand/15";
export const formGrid = "grid grid-cols-2 gap-x-4 min-w-0 " + fieldControl;
export const fieldFull = "col-span-2";
export const checkboxField =
  "flex items-center gap-2 text-sm my-1.5 mb-3.5 cursor-pointer";
export const checkList =
  "flex flex-col gap-0.5 mb-2 max-h-[280px] overflow-y-auto";

// --- Modal ---
export const modalOverlay =
  "fixed inset-0 bg-slate-900/45 flex items-center justify-center z-50";
export const modal =
  "bg-white rounded-xl w-[460px] max-w-[calc(100vw-32px)] shadow-modal";
export const modalHeader =
  "flex items-center justify-between py-4 px-5 border-b border-line";
export const modalClose =
  "bg-transparent border-none text-2xl leading-none cursor-pointer text-muted";
export const modalBody = "p-5";
export const modalActions = "flex justify-end gap-2.5 mt-2";
export const modalToolbar = "flex justify-between gap-2 mb-3";

// --- Misc states ---
export const centeredScreen = "min-h-screen flex items-center justify-center";
export const loginCard =
  "bg-white p-8 rounded-[14px] shadow-card w-[360px] max-w-[calc(100vw-32px)]";
export const loginBrand = "text-[20px] font-semibold";
export const loginSub = "text-muted mt-1 mb-6";
export const spinner = "p-6 text-muted text-center";
export const errorBox =
  "bg-red-50 border border-red-200 text-red-800 py-2.5 px-3 rounded-lg mb-3.5 text-[13px]";
export const okBox =
  "bg-green-100 border border-green-200 text-green-800 py-2.5 px-3 rounded-lg mb-3.5 text-[13px]";
export const empty = "p-7 text-center text-muted";
export const muted = "text-muted";
export const small = "text-xs";
export const backLink =
  "inline-block mb-3 text-brand no-underline text-sm hover:underline";
export const headActions = "flex gap-2 items-center";
export const rowGap = "flex items-center gap-2.5";

// --- Create page / grids ---
export const createGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-4 items-start";
export const inlineAdd =
  "flex gap-2 items-end mb-3.5 pb-3.5 border-b border-line [&>label]:!mb-0 [&>label]:flex-1";
export const filterGrid =
  "grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3";

// --- Product cards ---
export const productGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4";
export const productCard =
  "rounded-card border border-line bg-white shadow-card overflow-hidden";
export const productClickable = "cursor-pointer block";
export const productPhoto =
  "aspect-square bg-appbg [&_img]:w-full [&_img]:h-full [&_img]:object-cover [&_img]:block";
export const productPhotoImg = "w-full h-full object-cover block";
export const productPhotoEmpty =
  "w-full h-full flex items-center justify-center text-muted text-[13px]";
export const productSku = "text-xs text-muted px-3 pt-2.5";
export const productName = "font-semibold px-3 pt-0.5 break-words line-clamp-2";
export const productRow =
  "flex items-baseline justify-between px-3 pt-1.5 pb-3.5 gap-2";
export const productPrice = "text-[17px] font-bold";
export const productStock = "text-xs text-muted";
export const productStockWarn = "text-xs text-red-700 font-semibold";

// --- Product detail ---
export const detailSummary = "flex gap-[18px] items-center";
export const detailPhoto =
  "w-[120px] h-[120px] shrink-0 rounded-card overflow-hidden bg-appbg border border-line [&_img]:w-full [&_img]:h-full [&_img]:object-cover";
export const detailPhotoBack = "!w-[70px] !h-[70px]";
export const detailPhotoImg = "w-full h-full object-cover";

// --- Photo reports ---
export const reportGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4";
export const reportHead = "flex justify-between items-start mb-3";
export const reportFoot = "flex items-center justify-between gap-2.5 mt-3";
export const photoPair = "grid grid-cols-2 gap-2";
export const photoThumb =
  "relative block aspect-[4/3] rounded-lg overflow-hidden bg-appbg border border-line [&_img]:w-full [&_img]:h-full [&_img]:object-cover";
export const photoThumbImg = "w-full h-full object-cover";
export const photoStage =
  "absolute bottom-1.5 left-1.5 bg-slate-900/70 text-white text-[11px] py-0.5 px-[7px] rounded-md capitalize";
export const emptyThumb =
  "flex items-center justify-center text-muted text-xs bg-appbg border border-line rounded-lg aspect-[4/3]";
export const orderPhotos = "my-3";
export const orderPhotosHead = "flex items-center gap-3.5 mb-2";
export const tgLinks = "flex flex-wrap gap-2 items-center my-1";
export const tgLink = "no-underline";

// --- Orders: status editor + create-order form ---
export const orderEditor =
  "flex flex-wrap items-end gap-3 mt-3 pt-3 border-t border-line [&_.fld]:min-w-[180px]";
export const orderLineRow =
  "flex items-center gap-2.5 mb-2 " +
  "[&_input]:h-9 [&_input]:py-2 [&_input]:px-[11px] [&_input]:border [&_input]:border-line [&_input]:rounded-lg [&_input]:text-sm [&_input]:bg-white [&_input]:box-border [&_input:focus]:outline-none [&_input:focus]:border-brand [&_input:focus]:ring-[3px] [&_input:focus]:ring-brand/15 " +
  "[&_select]:h-9 [&_select]:py-1.5 [&_select]:px-2 [&_select]:border [&_select]:border-line [&_select]:rounded-lg [&_select]:text-sm [&_select]:bg-white [&_select]:box-border [&_select:focus]:outline-none [&_select:focus]:border-brand";
export const grow = "flex-1 min-w-0";
export const qtyInput = "w-[110px]";
export const sectionSub = "mt-[18px] mb-2 text-[0.95rem] text-muted";
export const orderTotal = "my-3.5 text-[1.05rem]";
export const refundDest = "flex flex-wrap gap-[18px] mt-3.5";
export const radio = "flex items-center gap-1.5 cursor-pointer";

// --- Receipt ---
export const receipt = "max-w-[640px]";
export const receiptLogo = "max-h-12 max-w-[220px]";
export const receiptHead =
  "flex items-center justify-between text-[1.1rem] border-b-2 border-line pb-2.5 mb-3";
export const receiptMeta =
  "grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-y-1 gap-x-[18px] mb-3.5 text-[0.9rem]";
export const receiptTotals = "mt-3 text-right grid gap-1";
export const receiptCell = "flex items-center gap-2";
export const receiptThumb =
  "w-[38px] h-[38px] object-cover rounded-md border border-line";
