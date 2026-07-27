const MENU_STORAGE_KEY = "daily-rituals-menu-v1";
const CART_STORAGE_KEY = "daily-rituals-order-v1";
const TABLE_STORAGE_KEY = "daily-rituals-table-v1";
const ORDERS_STORAGE_KEY = "daily-rituals-orders-v1";
const LAST_ORDER_STORAGE_KEY = "daily-rituals-last-order-v1";
const API_BASE = "/api";

const seedMenu = [
  { id: "espresso-tonic", category: "咖啡", name: "柑橘氣泡美式", nameEn: "Citrus Espresso Tonic", description: "雙份濃縮遇上葡萄柚氣泡，清爽又有層次。", price: 150, tag: "本月特調", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&w=900&q=85", soldOut: false },
  { id: "latte", category: "咖啡", name: "燕麥奶拿鐵", nameEn: "Oat Milk Latte", description: "柔和堅果香與細緻奶泡，日常最剛好的陪伴。", price: 135, tag: "人氣推薦", image: "https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=900&q=85", soldOut: false },
  { id: "pour-over", category: "咖啡", name: "衣索比亞手沖", nameEn: "Ethiopia Pour Over", description: "花香、柑橘與蜂蜜尾韻，為慢慢喝的人準備。", price: 180, tag: "單品豆", image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85", soldOut: false },
  { id: "earl-grey", category: "茶飲", name: "伯爵鮮奶茶", nameEn: "Earl Grey Milk Tea", description: "佛手柑香氣與滑順鮮奶，溫柔而不過甜。", price: 125, tag: "茶香", image: "https://images.unsplash.com/photo-1558857563-b371033873b8?auto=format&fit=crop&w=900&q=85", soldOut: false },
  { id: "matcha", category: "茶飲", name: "京都抹茶歐蕾", nameEn: "Kyoto Matcha Au Lait", description: "微苦抹茶與奶香交疊，入口圓潤、尾韻清甜。", price: 160, tag: "季節限定", image: "https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=85", soldOut: false },
  { id: "pound-cake", category: "甜點", name: "檸檬磅蛋糕", nameEn: "Lemon Pound Cake", description: "新鮮檸檬皮與奶油香，酸甜剛好配一杯咖啡。", price: 110, tag: "每日現烤", image: "https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=900&q=85", soldOut: false },
];

const payments = [
  { id: "linepay", label: "LINE Pay", note: "快速掃碼付款", icon: "LINE", className: "line" },
  { id: "card", label: "信用卡", note: "Visa · Mastercard", icon: "▣", className: "card" },
  { id: "jkopay", label: "街口支付", note: "街口 App", icon: "街", className: "jko" },
  { id: "cash", label: "現金", note: "櫃台付款", icon: "＄", className: "cash" },
];

const state = {
  view: new URLSearchParams(window.location.search).get("mode") === "owner" ? "owner" : "customer",
  managerPage: "dashboard",
  statsPeriod: "day",
  category: "全部",
  menu: loadMenu(),
  cart: loadCart(),
  table: loadTable(),
  orders: loadOrders(),
  lastOrder: loadLastOrder(),
  cartOpen: false,
  payment: "linepay",
  editingId: null,
};

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const checkoutDialog = document.querySelector("#checkout-dialog");
const itemDialog = document.querySelector("#item-dialog");
const checkoutSummary = document.querySelector("#checkout-summary");
const paymentOptions = document.querySelector("#payment-options");
const itemForm = document.querySelector("#item-form");

function parseStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

function loadMenu() {
  const saved = parseStorage(MENU_STORAGE_KEY, structuredClone(seedMenu));
  return Array.isArray(saved) ? saved.map((item) => ({ ...item, soldOut: Boolean(item.soldOut) })) : structuredClone(seedMenu);
}

function loadCart() {
  try { return JSON.parse(sessionStorage.getItem(CART_STORAGE_KEY)) || {}; } catch { return {}; }
}

function loadTable() {
  const table = sessionStorage.getItem(TABLE_STORAGE_KEY) || "";
  return /^(?:[1-9]|10)$/.test(table) ? table : "";
}
function loadOrders() { return parseStorage(ORDERS_STORAGE_KEY, []); }
function loadLastOrder() {
  try { return JSON.parse(sessionStorage.getItem(LAST_ORDER_STORAGE_KEY)) || null; } catch { return null; }
}
let cloudSyncAvailable = true;

async function cloudRequest(path, options = {}) {
  if (!cloudSyncAvailable) throw new Error("Cloud API unavailable");
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) },
  });
  if (!response.ok) {
    if (response.status === 404) cloudSyncAvailable = false;
    throw new Error(`Cloud API ${response.status}`);
  }
  return response.json();
}

async function putMenuToCloud(items = state.menu) {
  return cloudRequest("/menu", { method: "PUT", body: JSON.stringify({ items }) });
}

async function putOrdersToCloud(orders = state.orders) {
  return cloudRequest("/orders", { method: "PUT", body: JSON.stringify({ orders }) });
}

async function createOrderOnCloud(order) {
  return cloudRequest("/orders", { method: "POST", body: JSON.stringify({ order }) });
}

async function updateOrderOnCloud(order) {
  return cloudRequest(`/orders/${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status: order.status, completedAt: order.completedAt || null }),
  });
}

function saveMenu() {
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(state.menu));
  void putMenuToCloud().catch(() => {});
}
function saveCart() { sessionStorage.setItem(CART_STORAGE_KEY, JSON.stringify(state.cart)); }
function saveTable() { sessionStorage.setItem(TABLE_STORAGE_KEY, state.table); }
function saveOrders() { localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(state.orders)); }
function saveLastOrder() {
  if (state.lastOrder) sessionStorage.setItem(LAST_ORDER_STORAGE_KEY, JSON.stringify(state.lastOrder));
  else sessionStorage.removeItem(LAST_ORDER_STORAGE_KEY);
}
function money(value) { return Number(value || 0).toLocaleString("zh-TW"); }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" }[character])); }
function getCustomerLink() { return `${window.location.href.split("?")[0]}?mode=customer`; }
function cartItems() { return Object.entries(state.cart).map(([id, quantity]) => ({ item: state.menu.find((menuItem) => menuItem.id === id), quantity })).filter(({ item, quantity }) => item && quantity > 0); }
function cartCount() { return cartItems().reduce((sum, entry) => sum + entry.quantity, 0); }
function cartTotal() { return cartItems().reduce((sum, { item, quantity }) => sum + item.price * quantity, 0); }
function isToday(dateValue) { const date = new Date(dateValue); const now = new Date(); return date.toDateString() === now.toDateString(); }
function formatTime(dateValue) { return new Date(dateValue).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

function renderLegacy() {
  app.innerHTML = `<header class="topbar"><a class="brand" href="?mode=customer" aria-label="回到顧客點餐頁"><span class="brand-mark" aria-hidden="true">☕</span><span class="brand-copy"><strong>日常咖啡室</strong><span>DAILY RITUALS</span></span></a><nav class="mode-switch" aria-label="切換操作模式"><button class="${state.view === "customer" ? "active" : ""}" data-view="customer">顧客點餐</button><button class="${state.view === "owner" ? "active" : ""}" data-view="owner">店家管理</button></nav><div class="topbar-meta"><span class="open-status">營業中・今日 08:30–18:00</span><span class="qr-badge">掃碼即點餐</span></div></header><main id="main-content" class="content-wrap">${state.view === "customer" ? renderCustomer() : renderManager()}</main>`;
}

function renderCustomer() {
  const visibleMenu = state.menu.filter((item) => state.category === "全部" || item.category === state.category);
  return `<div class="customer-grid"><section class="customer-main" aria-labelledby="menu-title"><div class="hero"><div class="hero-copy"><span class="eyebrow">A SMALL COFFEE HOUSE · SINCE 2024</span><h1>把日常，沖成一杯剛好。</h1><p>選一杯今天想喝的，坐下來，讓時間慢一點。所有飲品皆可選擇冰／熱。</p><div class="hero-tags"><span>手沖咖啡</span><span>自家烘焙</span><span>每日甜點</span></div></div><div class="hero-cup" aria-hidden="true"><span class="steam"></span></div></div><div class="section-heading"><div><span class="eyebrow">TODAY'S MENU</span><h2 id="menu-title">今天想來點什麼？</h2></div><p>${state.menu.length} 款餐點・現點現做</p></div><div class="category-tabs" role="tablist" aria-label="餐點分類">${["全部", "咖啡", "茶飲", "甜點"].map((category) => `<button class="${state.category === category ? "active" : ""}" data-category="${category}" role="tab" aria-selected="${state.category === category}">${category}</button>`).join("")}</div><div class="menu-grid" style="margin-top: 18px">${visibleMenu.length ? visibleMenu.map(renderMenuCard).join("") : `<div class="manager-empty" style="grid-column: 1/-1">這個分類還沒有餐點。</div>`}</div></section>${renderCart()}${renderMobileCartTrigger()}</div>`;
}

function renderMenuCard(item) {
  const soldOut = item.soldOut;
  return `<article class="menu-card ${soldOut ? "is-sold-out" : ""}"><div class="menu-card__image"><img src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" loading="lazy" />${soldOut ? `<span class="soldout-ribbon">已售完</span>` : `<span class="menu-tag">${escapeHTML(item.tag || item.category)}</span>`}</div><div class="menu-card__body"><div class="menu-card__top"><div><h3>${escapeHTML(item.name)}</h3><p class="name-en">${escapeHTML(item.nameEn || "DAILY SPECIAL")}</p></div></div><p class="menu-card__description">${escapeHTML(item.description)}</p><div class="menu-card__footer"><span class="price">${money(item.price)}</span><button class="add-button ${soldOut ? "sold-out-button" : ""}" data-add="${escapeHTML(item.id)}" aria-label="${soldOut ? `${escapeHTML(item.name)}已售完` : `加入${escapeHTML(item.name)}`}" ${soldOut ? "disabled" : ""}>${soldOut ? "×" : "+"}</button></div></div></article>`;
}

function renderTableSelector() {
  const currentTable = String(state.table || "").trim();
  const tableOptions = ['<option value="" disabled ' + (currentTable ? "" : "selected") + '>請選擇桌號</option>']
    .concat(Array.from({ length: 10 }, (_, index) => {
      const table = String(index + 1);
      return `<option value="${table}" ${currentTable === table ? "selected" : ""}>桌號 ${table}</option>`;
    }))
    .join("");
  return `<label class="table-field"><span>內用桌號</span><select data-table-number aria-label="選擇桌號">${tableOptions}</select></label>`;
}

function renderCart() {
  const items = cartItems();
  const count = cartCount();
  const recentOrder = state.lastOrder;
  const recentItems = recentOrder?.items || [];
  const recentOrderMarkup = recentOrder ? `<section class="recent-order" aria-label="上一筆已送出的訂單"><div class="recent-order__heading"><div><span class="eyebrow">LAST ORDER</span><h3>上一筆訂單</h3></div><span class="recent-order__status">${escapeHTML(recentOrder.status || "已送出")}</span></div><p class="recent-order__table">桌號 ${escapeHTML(recentOrder.table)}・${escapeHTML(recentOrder.payment)}</p><div class="recent-order__items">${recentItems.map((item) => `<div><span>${escapeHTML(item.name)} × ${item.quantity}</span><strong>NT$ ${money(item.subtotal)}</strong></div>`).join("")}</div></section>` : "";
  const displayTotal = count ? cartTotal() : Number(recentOrder?.total || 0);
  return `<aside class="cart-panel ${items.length ? "has-items" : ""} ${state.cartOpen ? "cart-panel--mobile-open" : ""}" aria-label="購物車"><div class="cart-panel__head"><div><span class="eyebrow">YOUR ORDER</span><h2>你的訂單</h2></div><div class="cart-panel__head-actions"><span class="cart-count">${count}</span><button class="cart-close" type="button" data-close-cart aria-label="返回餐點">×</button></div></div>${renderTableSelector()}<div class="cart-items">${items.length ? items.map(renderCartItem).join("") : `<div class="empty-cart"><span aria-hidden="true">☕</span><p>購物車還是空的<br />挑一杯喜歡的開始吧</p></div>`}</div>${recentOrderMarkup}<div class="cart-summary"><div class="summary-row"><span>小計</span><span>NT$ ${money(displayTotal)}</span></div><div class="summary-row"><span>服務費</span><span>免服務費</span></div><div class="summary-row total"><span>合計</span><span>NT$ ${money(displayTotal)}</span></div><button class="primary-button primary-button--full" data-checkout ${count ? "" : "disabled"}>前往結帳 <span aria-hidden="true">→</span></button></div></aside>`;
}

function renderCartLegacy() {
  const items = cartItems();
  const count = cartCount();
  const recentOrder = state.lastOrder;
  const recentItems = recentOrder?.items || [];
  const recentOrderMarkup = recentOrder ? `<section class="recent-order" aria-label="上一筆已送出的訂單"><div class="recent-order__heading"><div><span class="eyebrow">LAST ORDER</span><h3>上一筆訂單</h3></div><span class="recent-order__status">${escapeHTML(recentOrder.status || "已送出")}</span></div><p class="recent-order__table">桌號 ${escapeHTML(recentOrder.table)}・${escapeHTML(recentOrder.payment)}</p><div class="recent-order__items">${recentItems.map((item) => `<div><span>${escapeHTML(item.name)} × ${item.quantity}</span><strong>NT$ ${money(item.subtotal)}</strong></div>`).join("")}</div><p class="recent-order__hint">下一位客人填寫同桌號後，這筆清單會自動清除。</p></section>` : "";
  return `<aside class="cart-panel ${items.length ? "has-items" : ""} ${state.cartOpen ? "cart-panel--mobile-open" : ""}" aria-label="購物車"><div class="cart-panel__head"><div><span class="eyebrow">YOUR ORDER</span><h2>你的訂單</h2></div><div class="cart-panel__head-actions"><span class="cart-count">${count}</span><button class="cart-close" type="button" data-close-cart aria-label="返回餐點">×</button></div></div><label class="table-field"><span>內用桌號</span><input data-table-number value="${escapeHTML(state.table)}" maxlength="8" placeholder="例如 A12" autocomplete="off" /></label><div class="cart-items">${items.length ? items.map(renderCartItem).join("") : `<div class="empty-cart"><span aria-hidden="true">☕</span><p>購物車還是空的<br />挑一杯喜歡的開始吧</p></div>`}</div>${recentOrderMarkup}<div class="cart-summary"><div class="summary-row"><span>小計</span><span>NT$ ${money(cartTotal())}</span></div><div class="summary-row"><span>服務費</span><span>免服務費</span></div><div class="summary-row total"><span>合計</span><span>NT$ ${money(cartTotal())}</span></div><button class="primary-button primary-button--full" data-checkout ${count ? "" : "disabled"}>前往結帳 <span aria-hidden="true">→</span></button></div></aside>`;
}

function renderMobileCartTrigger() {
  const count = cartCount();
  if (!count && !state.lastOrder) return "";
  const label = count ? `查看訂單・${count} 項` : "查看上一筆訂單";
  const total = count ? cartTotal() : Number(state.lastOrder?.total || 0);
  return `<button class="mobile-cart-trigger" type="button" data-open-cart><span>${label}</span><strong>NT$ ${money(total)}</strong><span aria-hidden="true">→</span></button>`;
}

function renderCartItem({ item, quantity }) {
  return `<div class="cart-item"><img src="${escapeHTML(item.image)}" alt="" /><div><h3>${escapeHTML(item.name)}</h3><p>NT$ ${money(item.price)}</p><div class="quantity-control"><button data-minus="${escapeHTML(item.id)}" aria-label="減少${escapeHTML(item.name)}數量">−</button><span>${quantity}</span><button data-plus="${escapeHTML(item.id)}" aria-label="增加${escapeHTML(item.name)}數量">＋</button></div></div><span class="cart-item__price">NT$ ${money(item.price * quantity)}</span></div>`;
}

function renderManagerLegacy() {
  const pages = [{ id: "dashboard", label: "營業統計" }, { id: "orders", label: "訂單明細" }, { id: "menu", label: "餐點管理" }];
  const pageTitle = pages.find((page) => page.id === state.managerPage)?.label || "營業統計";
  const pageDescription = state.managerPage === "menu" ? "更新餐點內容與供應狀態，顧客端會立即同步。" : state.managerPage === "orders" ? "查看桌號、餐點內容、付款方式與結帳金額。" : "掌握今天的營業額、銷售數量與熱門餐點。";
  return `<section aria-labelledby="manager-title"><div class="manager-heading"><div><span class="eyebrow">BACK OFFICE / ${state.managerPage.toUpperCase()}</span><h1 id="manager-title">${pageTitle}</h1></div><div><p>${pageDescription}</p>${state.managerPage === "menu" ? `<button class="primary-button" data-open-add>＋ 新增餐點</button>` : ""}</div></div><nav class="manager-tabs" aria-label="店家管理頁面">${pages.map((page) => `<button class="${state.managerPage === page.id ? "active" : ""}" data-manager-page="${page.id}">${page.label}</button>`).join("")}</nav>${state.managerPage === "dashboard" ? renderDashboard() : state.managerPage === "orders" ? renderOrdersPage() : renderMenuManager()}</section>`;
}

function getStats() {
  const todayOrders = state.orders.filter((order) => isToday(order.createdAt));
  const itemStats = {};
  todayOrders.forEach((order) => order.items.forEach((item) => { itemStats[item.name] = (itemStats[item.name] || 0) + item.quantity; }));
  const popular = Object.entries(itemStats).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const quantity = todayOrders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  return { todayOrders, popular, revenue, quantity, orderCount: todayOrders.length, average: todayOrders.length ? Math.round(revenue / todayOrders.length) : 0 };
}

function renderDashboardLegacy() {
  const stats = getStats();
  return `<div class="stats-row stats-row--four"><div class="stat-card"><span class="stat-card__label">今日營業額</span><strong class="stat-card__value stat-card__value--money">NT$ ${money(stats.revenue)}</strong></div><div class="stat-card"><span class="stat-card__label">今日售出數量</span><strong class="stat-card__value">${stats.quantity}<small> 杯／份</small></strong></div><div class="stat-card"><span class="stat-card__label">今日訂單</span><strong class="stat-card__value">${stats.orderCount}<small> 筆</small></strong></div><div class="stat-card"><span class="stat-card__label">平均客單</span><strong class="stat-card__value stat-card__value--money">NT$ ${money(stats.average)}</strong></div></div><div class="manager-layout"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">TOP ITEMS TODAY</span><h2>今日銷售數量</h2><p>依餐點統計已結帳的售出數量。</p></div></div>${stats.popular.length ? `<div class="sales-list">${stats.popular.map(([name, quantity], index) => `<div class="sales-row"><span class="sales-rank">${index + 1}</span><span class="sales-name">${escapeHTML(name)}</span><span class="sales-bar"><i style="width:${Math.max(18, (quantity / stats.popular[0][1]) * 100)}%"></i></span><strong>${quantity}</strong></div>`).join("")}</div>` : `<div class="manager-empty">今天還沒有結帳訂單，完成第一筆訂單後會顯示統計。</div>`}</section><aside class="panel"><div class="panel-heading"><div><span class="eyebrow">QUICK ACCESS</span><h2>快速查看</h2><p>需要核對桌號或訂單時，從這裡進入。</p></div></div><button class="secondary-button secondary-button--full" data-manager-page="orders">查看訂單明細 <span>→</span></button><button class="secondary-button secondary-button--full" data-manager-page="menu">管理餐點與售完狀態 <span>→</span></button></aside></div>`;
}

function renderOrdersPage() {
  const orders = [...state.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return `<section class="panel orders-panel"><div class="panel-heading"><div><span class="eyebrow">ALL ORDERS</span><h2>訂單明細</h2><p>共 ${orders.length} 筆本機訂單紀錄，最新訂單在最上方。</p></div></div>${orders.length ? `<div class="order-list">${orders.map(renderOrderCard).join("")}</div>` : `<div class="manager-empty">目前還沒有訂單。顧客完成結帳後，訂單會出現在這裡。</div>`}</section>`;
}

function renderOrderCardLegacy(order) {
  return `<article class="order-card"><div class="order-card__head"><div><span class="order-id">${escapeHTML(order.id)}</span><h3>桌號 ${escapeHTML(order.table)}</h3><p>${formatTime(order.createdAt)} · ${escapeHTML(order.payment)}</p></div><div class="order-total"><span>結帳金額</span><strong>NT$ ${money(order.total)}</strong></div></div><div class="order-items">${order.items.map((item) => `<div><span>${escapeHTML(item.name)} × ${item.quantity}</span><strong>NT$ ${money(item.subtotal)}</strong></div>`).join("")}</div><div class="order-card__foot"><span class="order-status">${escapeHTML(order.status || "已結帳")}</span><span>付款方式：${escapeHTML(order.payment)}</span></div></article>`;
}

function renderMenuManager() {
  const categoryCount = new Set(state.menu.map((item) => item.category)).size;
  return `<div class="stats-row"><div class="stat-card"><span class="stat-card__label">目前餐點</span><strong class="stat-card__value">${String(state.menu.length).padStart(2, "0")}</strong></div><div class="stat-card"><span class="stat-card__label">餐點分類</span><strong class="stat-card__value">${String(categoryCount).padStart(2, "0")}</strong></div><div class="stat-card"><span class="stat-card__label">已售完</span><strong class="stat-card__value">${String(state.menu.filter((item) => item.soldOut).length).padStart(2, "0")}</strong></div></div><div class="manager-layout"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">ALL ITEMS</span><h2>所有餐點</h2><p>可直接切換供應狀態，或編輯餐點內容。</p></div></div><div class="menu-admin-list">${state.menu.length ? state.menu.map(renderAdminRow).join("") : `<div class="manager-empty">還沒有餐點，先新增第一個品項吧。</div>`}</div></section><aside class="panel qr-panel"><div><span class="eyebrow">TABLE QR CODE</span><h2>掃碼點餐</h2><p>把 QR code 放在每張桌上，顧客掃描後就能直接點餐。</p></div><div class="qr-art"><img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&amp;data=${encodeURIComponent(getCustomerLink())}" alt="桌號 A12 點餐 QR code" /></div><div class="qr-actions"><button data-copy-link>複製點餐連結</button><button data-view="customer">預覽顧客端</button></div></aside></div>`;
}

function renderAdminRow(item) {
  return `<div class="admin-row ${item.soldOut ? "admin-row--sold-out" : ""}"><img class="admin-row__image" src="${escapeHTML(item.image)}" alt="${escapeHTML(item.name)}" /><div><h3>${escapeHTML(item.name)}</h3><p>${escapeHTML(item.category)} · ${escapeHTML(item.tag || "一般")}</p></div><span class="admin-row__price">NT$ ${money(item.price)}</span><div class="admin-row__actions"><button class="stock-status ${item.soldOut ? "is-sold-out" : ""}" data-toggle-soldout="${escapeHTML(item.id)}">${item.soldOut ? "已售完" : "販售中"}</button><button data-edit-item="${escapeHTML(item.id)}">編輯</button><button class="danger" data-delete-item="${escapeHTML(item.id)}">刪除</button></div></div>`;
}

function showToast(message) { toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2600); }
function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let copied = false;
  try { copied = document.execCommand("copy"); } catch { copied = false; }
  textarea.remove();
  return copied;
}
function copyCustomerLink() {
  const link = getCustomerLink();
  const onSuccess = () => showToast("點餐連結已複製");
  const onFailure = () => (fallbackCopy(link) ? onSuccess() : showToast("請手動複製目前網址"));
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(onSuccess).catch(onFailure);
  else onFailure();
}
function openDialog(dialog) { if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", ""); }
function closeDialog(dialog) { if (typeof dialog.close === "function" && dialog.open) dialog.close(); else dialog.removeAttribute("open"); }
function focusTableInput() { document.querySelector("[data-table-number]")?.focus(); }

function setQuantity(id, nextQuantity) {
  if (nextQuantity <= 0) delete state.cart[id]; else state.cart[id] = nextQuantity;
  saveCart(); render();
}

function openCheckout() {
  if (!cartCount()) { showToast("請先選擇餐點"); return; }
  if (!state.table.trim()) { showToast("請先填寫桌號，再前往結帳"); focusTableInput(); return; }
  checkoutSummary.innerHTML = `<div><span>桌號</span><strong>${escapeHTML(state.table.trim())}</strong></div><div><span>${cartCount()} 件餐點</span><strong>NT$ ${money(cartTotal())}</strong></div>`;
  paymentOptions.innerHTML = payments.map((payment) => `<button class="payment-option ${state.payment === payment.id ? "selected" : ""}" data-payment="${payment.id}"><span class="payment-icon ${payment.className}">${payment.icon}</span><span><strong>${payment.label}</strong><small>${payment.note}</small></span></button>`).join("");
  openDialog(checkoutDialog);
}

function openItemDialog(id = null) {
  state.editingId = id;
  const item = id ? state.menu.find((menuItem) => menuItem.id === id) : null;
  document.querySelector("#item-dialog-title").textContent = item ? "編輯餐點" : "新增餐點";
  itemForm.reset();
  itemForm.elements.id.value = item?.id || "";
  itemForm.elements.soldOut.checked = Boolean(item?.soldOut);
  if (item) Object.entries(item).forEach(([key, value]) => { if (itemForm.elements[key] && key !== "soldOut") itemForm.elements[key].value = value; });
  openDialog(itemDialog);
}

document.addEventListener("change", (event) => {
  if (!event.target.matches("[data-table-number]")) return;
  const nextTable = event.target.value.trim().toUpperCase();
  let clearedLastOrder = false;
  if (state.lastOrder && !cartCount() && nextTable === String(state.lastOrder.table || "").trim().toUpperCase()) {
    state.lastOrder = null;
    saveLastOrder();
    showToast("已開始下一筆點餐");
    clearedLastOrder = true;
  }
  state.table = nextTable;
  event.target.value = state.table;
  saveTable();
  if (clearedLastOrder) render();
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button, a") : null;
  if (!target) return;
  if (target.dataset.openCart !== undefined) { state.cartOpen = true; render(); return; }
  if (target.dataset.closeCart !== undefined) { state.cartOpen = false; render(); return; }
  if (target.dataset.view) { state.view = target.dataset.view; render(); return; }
  if (target.dataset.managerPage) { state.managerPage = target.dataset.managerPage; render(); return; }
  if (target.dataset.category) { state.category = target.dataset.category; render(); return; }
  if (target.dataset.add) { setQuantity(target.dataset.add, (state.cart[target.dataset.add] || 0) + 1); showToast("已加入你的訂單"); return; }
  if (target.dataset.plus) { setQuantity(target.dataset.plus, (state.cart[target.dataset.plus] || 0) + 1); return; }
  if (target.dataset.minus) { setQuantity(target.dataset.minus, (state.cart[target.dataset.minus] || 0) - 1); return; }
  if (target.dataset.checkout !== undefined) { openCheckout(); return; }
  if (target.dataset.payment) { state.payment = target.dataset.payment; paymentOptions.querySelectorAll("[data-payment]").forEach((option) => option.classList.toggle("selected", option.dataset.payment === state.payment)); return; }
  if (target.dataset.closeDialog) { closeDialog(document.querySelector(`#${target.dataset.closeDialog}`)); return; }
  if (target.dataset.openAdd !== undefined) { openItemDialog(); return; }
  if (target.dataset.editItem) { openItemDialog(target.dataset.editItem); return; }
  if (target.dataset.toggleSoldout) {
    state.menu = state.menu.map((item) => item.id === target.dataset.toggleSoldout ? { ...item, soldOut: !item.soldOut } : item);
    saveMenu(); render(); showToast("餐點供應狀態已更新"); return;
  }
  if (target.dataset.deleteItem) {
    const item = state.menu.find((menuItem) => menuItem.id === target.dataset.deleteItem);
    if (item && window.confirm(`確定要刪除「${item.name}」嗎？`)) { state.menu = state.menu.filter((menuItem) => menuItem.id !== item.id); delete state.cart[item.id]; saveMenu(); saveCart(); render(); showToast("餐點已刪除"); }
    return;
  }
  if (target.dataset.copyLink !== undefined) {
    copyCustomerLink();
    return;
  }
  if (target.dataset.submitPayment !== undefined) {
    if (!state.table.trim()) { closeDialog(checkoutDialog); showToast("請先填寫桌號"); focusTableInput(); return; }
    const payment = payments.find((option) => option.id === state.payment);
    const orderItems = cartItems().map(({ item, quantity }) => ({ id: item.id, name: item.name, quantity, price: item.price, subtotal: item.price * quantity }));
    const order = { id: `ORD-${String(Date.now()).slice(-6)}`, table: state.table.trim(), items: orderItems, total: cartTotal(), payment: payment.label, status: "已結帳", createdAt: new Date().toISOString() };
    state.orders = [order, ...state.orders]; saveOrders(); state.cart = {}; state.table = ""; saveCart(); sessionStorage.removeItem(TABLE_STORAGE_KEY); closeDialog(checkoutDialog); render(); showToast(`已送出訂單・${payment.label}付款`);
  }
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(itemForm).entries());
  const item = { id: data.id || `${Date.now()}-${data.name}`, category: data.category, name: data.name, nameEn: data.nameEn, description: data.description, price: Number(data.price), tag: data.tag || data.category, image: data.image, soldOut: itemForm.elements.soldOut.checked };
  if (state.editingId) state.menu = state.menu.map((entry) => entry.id === state.editingId ? item : entry); else state.menu = [item, ...state.menu];
  saveMenu(); closeDialog(itemDialog); render(); showToast(state.editingId ? "餐點已更新" : "新餐點已加入菜單");
});

render();

let knownOrderIds = new Set(state.orders.map((order) => order.id));
const newOrderDialog = document.querySelector("#new-order-dialog");
const newOrderTitle = document.querySelector("#new-order-title");
const newOrderSummary = document.querySelector("#new-order-summary");

function isPendingOrder(order) {
  return order.status !== "已結案";
}

function pendingOrders() {
  return state.orders.filter(isPendingOrder);
}

function render() {
  const ownerControls = state.view === "owner"
    ? '<nav class="mode-switch" aria-label="頁面切換"><button class="active" type="button" disabled>店家管理</button><a href="?mode=customer">顧客端預覽</a></nav>'
    : '<div aria-hidden="true"></div>';
  const statusText = state.view === "owner" ? "店家管理模式" : "營業中・今日 08:30–18:00";
  app.innerHTML = '<header class="topbar"><a class="brand" href="?mode=customer" aria-label="返回顧客點餐頁"><span class="brand-mark" aria-hidden="true">☕</span><span class="brand-copy"><strong>日常咖啡室</strong><span>DAILY RITUALS</span></span></a>' + ownerControls + '<div class="topbar-meta"><span class="open-status">' + statusText + '</span><span class="qr-badge">掃碼即點餐</span></div></header><main id="main-content" class="content-wrap">' + (state.view === "customer" ? renderCustomer() : renderManager()) + '</main>';
}

function renderManager() {
  const pages = [{ id: "dashboard", label: "營業統計" }, { id: "orders", label: "訂單明細" }, { id: "menu", label: "餐點管理" }];
  const pending = pendingOrders();
  const page = pages.find((entry) => entry.id === state.managerPage) || pages[0];
  const notice = pending.length
    ? '<div class="manager-alert" role="alert"><div class="manager-alert__content"><span class="manager-alert__icon" aria-hidden="true">🔔</span><div><strong>有 ' + pending.length + ' 筆訂單待出餐</strong><p>請查看餐點內容，完成出餐後按下「出餐結案」。</p></div></div><button class="primary-button" data-manager-page="orders">查看訂單 <span aria-hidden="true">→</span></button></div>'
    : "";
  const tabs = pages.map((entry) => '<button class="' + (state.managerPage === entry.id ? "active" : "") + '" data-manager-page="' + entry.id + '">' + entry.label + '</button>').join("");
  const description = state.managerPage === "menu" ? "更新餐點內容與供應狀態，顧客端會立即同步。" : state.managerPage === "orders" ? "查看桌號、餐點內容、付款方式與結帳金額，並完成出餐結案。" : "掌握今天的營業額、銷售數量與熱門餐點。";
  return '<section aria-labelledby="manager-title"><div class="manager-heading"><div><span class="eyebrow">BACK OFFICE / ' + state.managerPage.toUpperCase() + '</span><h1 id="manager-title">' + page.label + '</h1></div><div><p>' + description + '</p>' + (state.managerPage === "menu" ? '<button class="primary-button" data-open-add>＋ 新增餐點</button>' : "") + '</div></div>' + notice + '<nav class="manager-tabs" aria-label="店家管理頁面">' + tabs + '</nav>' + (state.managerPage === "dashboard" ? renderDashboard() : state.managerPage === "orders" ? renderOrdersPage() : renderMenuManager()) + '</section>';
}

function renderOrderCard(order) {
  const pending = isPendingOrder(order);
  const itemRows = order.items.map((item) => '<div><span>' + escapeHTML(item.name) + ' × ' + item.quantity + '</span><strong>NT$ ' + money(item.subtotal) + '</strong></div>').join("");
  const status = order.status || "待出餐";
  return '<article class="order-card ' + (pending ? "order-card--pending" : "order-card--completed") + '"><div class="order-card__head"><div><span class="order-id">' + escapeHTML(order.id) + '</span><h3>桌號 ' + escapeHTML(order.table) + '</h3><p>' + formatTime(order.createdAt) + ' · ' + escapeHTML(order.payment) + '</p></div><div class="order-total"><span>結帳金額</span><strong>NT$ ' + money(order.total) + '</strong></div></div><div class="order-items">' + itemRows + '</div><div class="order-card__foot"><span class="order-status ' + (pending ? "order-status--pending" : "") + '">' + escapeHTML(status) + '</span><span>付款方式：' + escapeHTML(order.payment) + '</span></div><div class="order-card__actions">' + (pending ? '<button class="primary-button complete-order-button" data-complete-order="' + escapeHTML(order.id) + '">出餐結案</button>' : '<span class="completed-label">已完成</span>') + '</div></article>';
}

function openNewOrderDialog(order) {
  if (!newOrderDialog || !order) return;
  newOrderTitle.textContent = "收到新訂單・桌號 " + order.table;
  newOrderSummary.innerHTML = '<div><span>餐點</span><strong>' + escapeHTML(order.items.map((item) => item.name + " × " + item.quantity).join("、")) + '</strong></div><div><span>結帳金額</span><strong>NT$ ' + money(order.total) + '</strong></div><div><span>付款方式</span><strong>' + escapeHTML(order.payment) + '</strong></div>';
  openDialog(newOrderDialog);
}

function refreshLastOrderFromList(orders) {
  if (!state.lastOrder?.id) return false;
  const remoteOrder = orders.find((order) => order.id === state.lastOrder.id);
  if (!remoteOrder) return false;
  const statusChanged = remoteOrder.status !== state.lastOrder.status || (remoteOrder.completedAt || null) !== (state.lastOrder.completedAt || null);
  if (!statusChanged) return false;
  state.lastOrder = { ...state.lastOrder, ...remoteOrder };
  saveLastOrder();
  return true;
}

async function syncOrders(notify = false) {
  if (cloudSyncAvailable) {
    try {
      const result = await cloudRequest("/orders");
      const cloudOrders = Array.isArray(result.orders) ? result.orders : [];
      const localOrders = loadOrders();
      const latestOrders = cloudOrders.length || !localOrders.length ? cloudOrders : localOrders;
      if (!cloudOrders.length && localOrders.length) await putOrdersToCloud(localOrders);
      const newOrders = latestOrders.filter((order) => !knownOrderIds.has(order.id));
      state.orders = latestOrders;
      localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(state.orders));
      knownOrderIds = new Set(latestOrders.map((order) => order.id));
      const lastOrderChanged = refreshLastOrderFromList(latestOrders);
      if (state.view === "owner" && newOrders.length) state.managerPage = "orders";
      if (state.view === "owner" || lastOrderChanged) render();
      if (notify && state.view === "owner" && newOrders.length) {
        showToast("收到新訂單・桌號 " + newOrders[0].table);
        openNewOrderDialog(newOrders[0]);
      }
      return;
    } catch {
      // Keep the local fallback below when the API is unavailable.
    }
  }

  const latestOrders = loadOrders();
  const newOrders = latestOrders.filter((order) => !knownOrderIds.has(order.id));
  state.orders = latestOrders;
  knownOrderIds = new Set(latestOrders.map((order) => order.id));
  const lastOrderChanged = refreshLastOrderFromList(latestOrders);
  if (state.view === "owner" && newOrders.length) state.managerPage = "orders";
  if (state.view === "owner" || lastOrderChanged) render();
  if (notify && state.view === "owner" && newOrders.length) {
    showToast("收到新訂單・桌號 " + newOrders[0].table);
    openNewOrderDialog(newOrders[0]);
  }
}

async function syncMenuFromCloud() {
  if (!cloudSyncAvailable) return;
  try {
    const result = await cloudRequest("/menu");
    if (Array.isArray(result.items) && result.items.length) {
      const nextMenu = result.items.map((item) => ({ ...item, soldOut: Boolean(item.soldOut) }));
      const menuChanged = JSON.stringify(state.menu) !== JSON.stringify(nextMenu);
      state.menu = nextMenu;
      if (menuChanged) {
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(state.menu));
        render();
      }
    } else if (state.menu.length) {
      await putMenuToCloud(state.menu);
    }
  } catch {
    // The local menu remains usable while the API is unavailable.
  }
}

async function hydrateCloudState() {
  await syncMenuFromCloud();
  await syncOrders(false);
}

function completeOrder(orderId) {
  const order = state.orders.find((entry) => entry.id === orderId);
  if (!order || !isPendingOrder(order)) return;
  order.status = "已結案";
  order.completedAt = new Date().toISOString();
  saveOrders();
  void updateOrderOnCloud(order).catch(() => {});
  knownOrderIds.add(order.id);
  render();
  showToast("訂單 " + order.id + " 已完成出餐結案");
}

async function submitOrderFromPayment(event) {
  const button = event.target instanceof Element ? event.target.closest("button") : null;
  if (!button || button.dataset.submitPayment === undefined) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (!state.table.trim()) {
    closeDialog(checkoutDialog);
    showToast("請先填寫桌號");
    focusTableInput();
    return;
  }
  const payment = payments.find((option) => option.id === state.payment) || payments[0];
  const orderItems = cartItems().map(({ item, quantity }) => ({ id: item.id, name: item.name, quantity, price: item.price, subtotal: item.price * quantity }));
  const order = { id: "ORD-" + String(Date.now()).slice(-6), table: state.table.trim(), items: orderItems, total: cartTotal(), payment: payment.label, status: "待出餐", createdAt: new Date().toISOString() };
  state.orders = [order, ...state.orders];
  knownOrderIds.add(order.id);
  saveOrders();
  let cloudSaved = false;
  try {
    await createOrderOnCloud(order);
    cloudSaved = true;
  } catch {
    // Keep the order locally so it is not lost if the API is temporarily unavailable.
  }
  state.lastOrder = structuredClone(order);
  saveLastOrder();
  state.cart = {};
  state.table = "";
  state.cartOpen = true;
  saveCart();
  sessionStorage.removeItem(TABLE_STORAGE_KEY);
  closeDialog(checkoutDialog);
  render();
  showToast(cloudSaved ? "訂單已送出，店家將開始準備" : "訂單已暫存，網路恢復後再同步");
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button, a") : null;
  if (!target) return;
  if (target.dataset.openOrders !== undefined) {
    closeDialog(newOrderDialog);
    state.managerPage = "orders";
    render();
    return;
  }
  if (target.dataset.completeOrder) {
    completeOrder(target.dataset.completeOrder);
  }
});

document.addEventListener("click", submitOrderFromPayment, true);

window.addEventListener("storage", (event) => {
  if (event.key === ORDERS_STORAGE_KEY) syncOrders(true);
  if (event.key === MENU_STORAGE_KEY) {
    state.menu = loadMenu();
    render();
  }
});

window.setInterval(() => {
  void syncMenuFromCloud();
  if (state.view === "owner") void syncOrders(true);
  else if (state.lastOrder) void syncOrders(false);
}, 3000);

function getPeriodStats(period = state.statsPeriod) {
  const now = new Date();
  const key = ["day", "month", "year"].includes(period) ? period : "day";
  const configs = {
    day: { label: "日", title: "今日營業趨勢", revenueLabel: "今日營業額", quantityLabel: "今日售出數量", orderLabel: "今日訂單", averageLabel: "平均客單", periodText: now.toLocaleDateString("zh-TW"), bucketCount: 24, bucketLabel: (index) => String(index).padStart(2, "0") + ":00", matches: (date) => date.toDateString() === now.toDateString(), getIndex: (date) => date.getHours() },
    month: { label: "月", title: "本月營業趨勢", revenueLabel: "本月營業額", quantityLabel: "本月售出數量", orderLabel: "本月訂單", averageLabel: "平均客單", periodText: now.getFullYear() + " 年 " + (now.getMonth() + 1) + " 月", bucketCount: new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), bucketLabel: (index) => (index + 1) + "日", matches: (date) => date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth(), getIndex: (date) => date.getDate() - 1 },
    year: { label: "年", title: "本年度營業趨勢", revenueLabel: "本年度營業額", quantityLabel: "本年度售出數量", orderLabel: "本年度訂單", averageLabel: "平均客單", periodText: now.getFullYear() + " 年", bucketCount: 12, bucketLabel: (index) => (index + 1) + "月", matches: (date) => date.getFullYear() === now.getFullYear(), getIndex: (date) => date.getMonth() },
  }[key];
  const buckets = Array.from({ length: configs.bucketCount }, (_, index) => ({ label: configs.bucketLabel(index), revenue: 0, quantity: 0, orderCount: 0 }));
  const orders = state.orders.filter((order) => {
    const date = new Date(order.createdAt);
    return !Number.isNaN(date.getTime()) && configs.matches(date);
  });
  const itemStats = {};
  orders.forEach((order) => {
    const date = new Date(order.createdAt);
    const bucket = buckets[configs.getIndex(date)];
    if (bucket) {
      bucket.revenue += Number(order.total || 0);
      bucket.orderCount += 1;
    }
    (order.items || []).forEach((item) => {
      const quantity = Number(item.quantity || 0);
      if (bucket) bucket.quantity += quantity;
      itemStats[item.name] = (itemStats[item.name] || 0) + quantity;
    });
  });
  const revenue = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const quantity = orders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0);
  return { ...configs, key, orders, buckets, revenue, quantity, orderCount: orders.length, average: orders.length ? Math.round(revenue / orders.length) : 0, popular: Object.entries(itemStats).sort((a, b) => b[1] - a[1]).slice(0, 5) };
}

function renderTrendChart(stats) {
  const maxRevenue = Math.max(1, ...stats.buckets.map((bucket) => bucket.revenue));
  const maxQuantity = Math.max(1, ...stats.buckets.map((bucket) => bucket.quantity));
  const columns = stats.buckets.map((bucket) => {
    const revenueHeight = bucket.revenue ? Math.max(8, (bucket.revenue / maxRevenue) * 100) : 3;
    const quantityHeight = bucket.quantity ? Math.max(8, (bucket.quantity / maxQuantity) * 100) : 3;
    const tooltip = bucket.label + "｜營業額 NT$ " + money(bucket.revenue) + "｜售出 " + bucket.quantity + "｜訂單 " + bucket.orderCount;
    return '<div class="trend-column" title="' + escapeHTML(tooltip) + '"><div class="trend-bars"><span class="trend-bar trend-bar--revenue" style="height:' + revenueHeight + '%"></span><span class="trend-bar trend-bar--quantity" style="height:' + quantityHeight + '%"></span></div><span class="trend-label">' + escapeHTML(bucket.label) + '</span></div>';
  }).join("");
  return '<div class="trend-scroll"><div class="trend-chart" style="--trend-columns:' + stats.buckets.length + '">' + columns + '</div></div><div class="chart-legend"><span><i class="legend-dot legend-dot--revenue"></i>營業額</span><span><i class="legend-dot legend-dot--quantity"></i>售出數量</span><small>滑過柱狀圖查看詳細數據</small></div>';
}

function renderDashboard() {
  const stats = getPeriodStats();
  const periodButtons = ["day", "month", "year"].map((period) => '<button class="' + (stats.key === period ? "active" : "") + '" data-stats-period="' + period + '">' + ({ day: "日", month: "月", year: "年" }[period]) + '</button>').join("");
  const popular = stats.popular.length
    ? '<div class="sales-list">' + stats.popular.map(([name, quantity], index) => '<div class="sales-row"><span class="sales-rank">' + (index + 1) + '</span><span class="sales-name">' + escapeHTML(name) + '</span><span class="sales-bar"><i style="width:' + Math.max(18, (quantity / stats.popular[0][1]) * 100) + '%"></i></span><strong>' + quantity + '</strong></div>').join("") + '</div>'
    : '<div class="manager-empty">目前區間還沒有結帳訂單。</div>';
  return '<div class="stats-period-toolbar"><div class="period-switch" role="tablist" aria-label="統計區間">' + periodButtons + '</div><button class="secondary-button export-stats-button" data-export-stats>匯出目前統計 CSV <span aria-hidden="true">↓</span></button></div><div class="stats-row stats-row--four"><div class="stat-card"><span class="stat-card__label">' + stats.revenueLabel + '</span><strong class="stat-card__value stat-card__value--money">NT$ ' + money(stats.revenue) + '</strong></div><div class="stat-card"><span class="stat-card__label">' + stats.quantityLabel + '</span><strong class="stat-card__value">' + stats.quantity + '<small> 杯／份</small></strong></div><div class="stat-card"><span class="stat-card__label">' + stats.orderLabel + '</span><strong class="stat-card__value">' + stats.orderCount + '<small> 筆</small></strong></div><div class="stat-card"><span class="stat-card__label">' + stats.averageLabel + '</span><strong class="stat-card__value stat-card__value--money">NT$ ' + money(stats.average) + '</strong></div></div><section class="panel trend-panel"><div class="panel-heading"><div><span class="eyebrow">SALES TREND / ' + stats.key.toUpperCase() + '</span><h2>' + stats.title + '</h2><p>' + escapeHTML(stats.periodText) + '，柱狀圖同時呈現營業額與售出數量。</p></div></div>' + renderTrendChart(stats) + '</section><div class="manager-layout"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">TOP ITEMS</span><h2>熱門餐點數量</h2><p>依目前統計區間的已結帳訂單計算。</p></div></div>' + popular + '</section><aside class="panel"><div class="panel-heading"><div><span class="eyebrow">QUICK ACCESS</span><h2>快速查看</h2><p>需要核對桌號或餐點內容時，從這裡進入。</p></div></div><button class="secondary-button secondary-button--full" data-manager-page="orders">查看訂單明細 <span>→</span></button><button class="secondary-button secondary-button--full" data-manager-page="menu">管理餐點與售完狀態 <span>→</span></button></aside></div>';
}

function csvCell(value) {
  return '"' + String(value ?? "").replace(/"/g, '""') + '"';
}

function exportStats() {
  const stats = getPeriodStats();
  const rows = [
    ["營業統計", stats.title],
    ["統計期間", stats.periodText],
    ["營業額", "NT$ " + stats.revenue],
    ["售出數量", stats.quantity],
    ["訂單數", stats.orderCount],
    ["平均客單", "NT$ " + stats.average],
    [],
    ["時間區段", "營業額", "售出數量", "訂單數"],
    ...stats.buckets.map((bucket) => [bucket.label, "NT$ " + bucket.revenue, bucket.quantity, bucket.orderCount]),
    [],
    ["餐點", "售出數量"],
    ...stats.popular.map(([name, quantity]) => [name, quantity]),
  ];
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "daily-rituals-" + stats.key + "-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("營業統計已匯出");
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target.closest("button, a") : null;
  if (!target) return;
  if (target.dataset.statsPeriod) {
    state.statsPeriod = target.dataset.statsPeriod;
    state.managerPage = "dashboard";
    render();
    return;
  }
  if (target.dataset.exportStats !== undefined) {
    exportStats();
  }
});

void hydrateCloudState();
