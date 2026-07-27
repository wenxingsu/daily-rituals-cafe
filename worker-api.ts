type PreparedStatement = {
  bind(...values: unknown[]): PreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
};

type Database = {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown>;
};

type Env = {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DB: Database;
};

type MenuItem = {
  id: string;
  category: string;
  name: string;
  nameEn?: string;
  description?: string;
  price: number;
  tag?: string;
  image?: string;
  soldOut?: boolean;
};

type OrderItem = {
  id?: string;
  menuItemId?: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
};

type Order = {
  id: string;
  table: string;
  items: OrderItem[];
  total: number;
  payment: string;
  status: string;
  createdAt: string;
  completedAt?: string | null;
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-headers", "content-type");
  headers.set("access-control-allow-methods", "GET,POST,PUT,PATCH,OPTIONS");
  return new Response(response.body, { status: response.status, headers });
}

function now() {
  return new Date().toISOString();
}

function cleanMenuItem(value: Partial<MenuItem>): MenuItem {
  return {
    id: String(value.id || "").trim(),
    category: String(value.category || "其他").trim(),
    name: String(value.name || "未命名餐點").trim(),
    nameEn: String(value.nameEn || ""),
    description: String(value.description || ""),
    price: Math.max(0, Number(value.price || 0)),
    tag: String(value.tag || value.category || ""),
    image: String(value.image || ""),
    soldOut: Boolean(value.soldOut),
  };
}

function cleanOrder(value: Partial<Order>): Order {
  return {
    id: String(value.id || "").trim(),
    table: String(value.table || "").trim(),
    items: Array.isArray(value.items)
      ? value.items.map((item) => ({
          id: String(item.id || item.menuItemId || ""),
          menuItemId: String(item.menuItemId || item.id || ""),
          name: String(item.name || "未命名餐點"),
          quantity: Math.max(1, Number(item.quantity || 1)),
          price: Math.max(0, Number(item.price || 0)),
          subtotal: Math.max(0, Number(item.subtotal || 0)),
        }))
      : [],
    total: Math.max(0, Number(value.total || 0)),
    payment: String(value.payment || "現金"),
    status: String(value.status || "待出餐"),
    createdAt: String(value.createdAt || now()),
    completedAt: value.completedAt ? String(value.completedAt) : null,
  };
}

async function readBody(request: Request): Promise<Record<string, any>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}

async function getMenu(env: Env): Promise<Response> {
  const result = await env.DB.prepare(
    "SELECT id, category, name, name_en, description, price, tag, image, sold_out FROM menu_items ORDER BY category, id",
  ).all<Record<string, unknown>>();
  const items = result.results.map((item) => ({
    id: String(item.id),
    category: String(item.category),
    name: String(item.name),
    nameEn: String(item.name_en || ""),
    description: String(item.description || ""),
    price: Number(item.price || 0),
    tag: String(item.tag || ""),
    image: String(item.image || ""),
    soldOut: Boolean(item.sold_out),
  }));
  return json({ items });
}

async function replaceMenu(env: Env, body: Record<string, any>): Promise<Response> {
  const items = Array.isArray(body.items) ? body.items.map(cleanMenuItem).filter((item) => item.id) : [];
  const timestamp = now();
  const statements = [env.DB.prepare("DELETE FROM menu_items")];
  for (const item of items) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO menu_items (id, category, name, name_en, description, price, tag, image, sold_out, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(
        item.id,
        item.category,
        item.name,
        item.nameEn || null,
        item.description || null,
        item.price,
        item.tag || null,
        item.image || null,
        item.soldOut ? 1 : 0,
        timestamp,
        timestamp,
      ),
    );
  }
  await env.DB.batch(statements);
  return json({ ok: true, count: items.length });
}

async function getOrders(env: Env): Promise<Response> {
  const ordersResult = await env.DB.prepare(
    "SELECT id, table_number, total, payment_method, status, created_at, completed_at FROM orders ORDER BY created_at DESC LIMIT 500",
  ).all<Record<string, unknown>>();
  const itemsResult = await env.DB.prepare(
    "SELECT order_id, menu_item_id, name, quantity, price, subtotal FROM order_items ORDER BY id",
  ).all<Record<string, unknown>>();
  const itemMap = new Map<string, OrderItem[]>();
  for (const item of itemsResult.results) {
    const orderId = String(item.order_id);
    const orderItems = itemMap.get(orderId) || [];
    orderItems.push({
      id: String(item.menu_item_id || ""),
      menuItemId: String(item.menu_item_id || ""),
      name: String(item.name),
      quantity: Number(item.quantity || 0),
      price: Number(item.price || 0),
      subtotal: Number(item.subtotal || 0),
    });
    itemMap.set(orderId, orderItems);
  }
  const orders = ordersResult.results.map((order) => ({
    id: String(order.id),
    table: String(order.table_number),
    items: itemMap.get(String(order.id)) || [],
    total: Number(order.total || 0),
    payment: String(order.payment_method),
    status: String(order.status),
    createdAt: String(order.created_at),
    completedAt: order.completed_at ? String(order.completed_at) : null,
  }));
  return json({ orders });
}

function insertOrderStatements(env: Env, order: Order): PreparedStatement[] {
  const statements: PreparedStatement[] = [
    env.DB.prepare(
      "INSERT OR REPLACE INTO orders (id, table_number, total, payment_method, status, created_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(order.id, order.table, order.total, order.payment, order.status, order.createdAt, order.completedAt || null),
  ];
  for (const item of order.items) {
    statements.push(
      env.DB.prepare(
        "INSERT INTO order_items (order_id, menu_item_id, name, quantity, price, subtotal) VALUES (?, ?, ?, ?, ?, ?)",
      ).bind(order.id, item.menuItemId || item.id || null, item.name, item.quantity, item.price, item.subtotal),
    );
  }
  return statements;
}

async function replaceOrders(env: Env, body: Record<string, any>): Promise<Response> {
  const orders = Array.isArray(body.orders) ? body.orders.map(cleanOrder).filter((order) => order.id && order.table) : [];
  const statements = [env.DB.prepare("DELETE FROM order_items"), env.DB.prepare("DELETE FROM orders")];
  for (const order of orders) statements.push(...insertOrderStatements(env, order));
  await env.DB.batch(statements);
  return json({ ok: true, count: orders.length });
}

async function createOrder(env: Env, body: Record<string, any>): Promise<Response> {
  const order = cleanOrder(body.order || body);
  if (!order.id || !order.table || !order.items.length) return json({ error: "Invalid order" }, 400);
  await env.DB.batch(insertOrderStatements(env, order));
  return json({ ok: true, order }, 201);
}

async function updateOrder(env: Env, id: string, body: Record<string, any>): Promise<Response> {
  const status = String(body.status || "待出餐");
  const completedAt = body.completedAt ? String(body.completedAt) : null;
  await env.DB.prepare("UPDATE orders SET status = ?, completed_at = ? WHERE id = ?").bind(status, completedAt, id).run();
  return json({ ok: true });
}

async function api(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
  try {
    if (url.pathname === "/api/menu" && request.method === "GET") return cors(await getMenu(env));
    if (url.pathname === "/api/menu" && request.method === "PUT") return cors(await replaceMenu(env, await readBody(request)));
    if (url.pathname === "/api/orders" && request.method === "GET") return cors(await getOrders(env));
    if (url.pathname === "/api/orders" && request.method === "POST") return cors(await createOrder(env, await readBody(request)));
    if (url.pathname === "/api/orders" && request.method === "PUT") return cors(await replaceOrders(env, await readBody(request)));
    const orderMatch = url.pathname.match(/^\/api\/orders\/([^/]+)$/);
    if (orderMatch && request.method === "PATCH") return cors(await updateOrder(env, decodeURIComponent(orderMatch[1]), await readBody(request)));
    return cors(json({ error: "Not found" }, 404));
  } catch (error) {
    console.error(error);
    return cors(json({ error: "Database request failed" }, 500));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env);
    return env.ASSETS.fetch(request);
  },
};
