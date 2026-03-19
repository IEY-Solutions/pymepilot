/**
 * Datos ficticios para los videos de onboarding.
 * Distribuidor inventado — ningun dato real de ningun tenant.
 */

// --- Tenant ---

export const mockTenant = {
  name: "Distribuidora Demo",
  erp_type: "contabilium",
  last_sync: "2026-03-19T05:12:00Z",
};

// --- Clientes ---

export const mockCustomers = [
  { id: "c1", name: "Electronica Sur", phone: "11-5555-0001", email: "contacto@electronicasur.com", total_purchases: 845000, last_purchase: "2026-03-15", avg_days_between: 18 },
  { id: "c2", name: "TechStore Buenos Aires", phone: "11-5555-0002", email: "ventas@techstore.com.ar", total_purchases: 620000, last_purchase: "2026-03-12", avg_days_between: 22 },
  { id: "c3", name: "Mundo Celular", phone: "11-5555-0003", email: "compras@mundocelular.com", total_purchases: 510000, last_purchase: "2026-03-08", avg_days_between: 25 },
  { id: "c4", name: "Accesorios Express", phone: "11-5555-0004", email: "pedidos@accexpress.com.ar", total_purchases: 390000, last_purchase: "2026-02-28", avg_days_between: 30 },
  { id: "c5", name: "Digital Zone", phone: "11-5555-0005", email: "info@digitalzone.com.ar", total_purchases: 280000, last_purchase: "2026-03-17", avg_days_between: 15 },
  { id: "c6", name: "MegaCell Rosario", phone: "341-555-0006", email: "ventas@megacell.com.ar", total_purchases: 195000, last_purchase: "2026-01-20", avg_days_between: 45 },
  { id: "c7", name: "PhoneWorld Cordoba", phone: "351-555-0007", email: "compras@phoneworld.com.ar", total_purchases: 150000, last_purchase: "2026-02-10", avg_days_between: 35 },
  { id: "c8", name: "Importadora Norte", phone: "381-555-0008", email: "info@impnorte.com.ar", total_purchases: 95000, last_purchase: "2026-03-01", avg_days_between: 28 },
  { id: "c9", name: "Casa Tech", phone: "11-5555-0009", email: "ventas@casatech.com.ar", total_purchases: 72000, last_purchase: "2025-12-15", avg_days_between: 60 },
  { id: "c10", name: "Conectar SRL", phone: "11-5555-0010", email: "pedidos@conectar.com.ar", total_purchases: 45000, last_purchase: "2026-03-18", avg_days_between: 20 },
];

// --- Productos ---

export const mockProducts = [
  { id: "p1", name: "Funda MagSafe Premium", sku: "FMP-001", price: 8500, stock: 120 },
  { id: "p2", name: "Cargador Inalambrico 15W", sku: "CI-015", price: 12000, stock: 85 },
  { id: "p3", name: "Cable USB-C 2m", sku: "CUC-200", price: 3500, stock: 200 },
  { id: "p4", name: "Soporte MagSafe Auto", sku: "SMA-001", price: 15000, stock: 45 },
  { id: "p5", name: "Power Bank 10000mAh", sku: "PB-100", price: 18000, stock: 60 },
  { id: "p6", name: "Protector Pantalla 9H", sku: "PP-9H", price: 2800, stock: 300 },
  { id: "p7", name: "Auriculares BT Pro", sku: "ABT-PRO", price: 22000, stock: 35 },
  { id: "p8", name: "Funda Transparente", sku: "FT-001", price: 4500, stock: 180 },
  { id: "p9", name: "Adaptador USB-C Hub", sku: "AUH-001", price: 25000, stock: 20 },
  { id: "p10", name: "Soporte Escritorio", sku: "SE-001", price: 9500, stock: 70 },
];

// --- KPIs del Inicio ---

export const mockKPIs = {
  pendientes: 12,
  tasaContacto: 78,
  clientesActivos: 45,
  ultimaSync: "Hace 2 horas",
  prediccionesHoy: 12,
  ultimoOrquestador: "05:12 AM",
};

// --- Pipeline ---

export const mockPipelineCards = [
  { id: "pl1", customer: mockCustomers[0], stage: "a_contactar", message: "Electronica Sur suele reponer cada 18 dias. Ya pasaron 4 dias desde su ultima compra, buen momento para ofrecer Fundas MagSafe y Cargadores.", confidence: 0.87, priority: "high" as const },
  { id: "pl2", customer: mockCustomers[1], stage: "a_contactar", message: "TechStore compro Cables y Protectores el 12/3. Suelen agregar Soportes MagSafe — buen momento para cross-sell.", confidence: 0.72, priority: "medium" as const },
  { id: "pl3", customer: mockCustomers[4], stage: "contactado", message: "Digital Zone es cliente frecuente. Ofrecer Power Bank y Auriculares BT que nunca compro.", confidence: 0.65, priority: "medium" as const },
  { id: "pl4", customer: mockCustomers[2], stage: "en_seguimiento", message: "Mundo Celular pidio cotizacion de Auriculares BT Pro. Hacer seguimiento.", confidence: 0.81, priority: "high" as const },
  { id: "pl5", customer: mockCustomers[7], stage: "por_cotizar", message: "Importadora Norte consulto precios de Adaptadores USB-C Hub. Enviar cotizacion.", confidence: 0.60, priority: "low" as const },
  { id: "pl6", customer: mockCustomers[9], stage: "cotizacion_enviada", message: "Conectar SRL recibio cotizacion por 50 Fundas Transparentes. Esperar respuesta.", confidence: 0.75, priority: "medium" as const },
  { id: "pl7", customer: mockCustomers[3], stage: "vendido", message: "Accesorios Express confirmo pedido de 30 Cargadores + 20 Soportes. Cerrado!", confidence: 0.95, priority: "high" as const },
];

export const mockPipelineStages = [
  { id: "a_contactar", label: "A contactar", count: 2 },
  { id: "contactado", label: "Contactado", count: 1 },
  { id: "en_seguimiento", label: "En seguimiento", count: 1 },
  { id: "por_cotizar", label: "Por cotizar", count: 1 },
  { id: "cotizacion_enviada", label: "Cotizacion enviada", count: 1 },
  { id: "vendido", label: "Vendido", count: 1 },
];

// --- Cuentas Clave ---

export const mockKeyAccounts = [
  { customer: mockCustomers[0], health_score: 92, notes_count: 5, pending_actions: 0, trend: "up" as const },
  { customer: mockCustomers[1], health_score: 78, notes_count: 3, pending_actions: 1, trend: "stable" as const },
  { customer: mockCustomers[2], health_score: 45, notes_count: 2, pending_actions: 2, trend: "down" as const },
  { customer: mockCustomers[4], health_score: 88, notes_count: 4, pending_actions: 0, trend: "up" as const },
];

// --- Metricas ---

export const mockRevenueByMonth = [
  { month: "Oct", recurrente: 320000, nuevo: 85000 },
  { month: "Nov", recurrente: 380000, nuevo: 120000 },
  { month: "Dic", recurrente: 450000, nuevo: 95000 },
  { month: "Ene", recurrente: 290000, nuevo: 60000 },
  { month: "Feb", recurrente: 410000, nuevo: 110000 },
  { month: "Mar", recurrente: 480000, nuevo: 135000 },
];

export const mockChurnByMonth = [
  { month: "Oct", rate: 12 },
  { month: "Nov", rate: 10 },
  { month: "Dic", rate: 8 },
  { month: "Ene", rate: 15 },
  { month: "Feb", rate: 9 },
  { month: "Mar", rate: 7 },
];

// --- Logros ---

export const mockAchievements = [
  { customer: "Accesorios Express", vertical: "Reposicion", amount: 45000, date: "2026-03-15", products: ["Cargador Inalambrico 15W", "Soporte MagSafe Auto"] },
  { customer: "Electronica Sur", vertical: "Cross-sell", amount: 66000, date: "2026-03-14", products: ["Auriculares BT Pro", "Power Bank 10000mAh"] },
  { customer: "Digital Zone", vertical: "Reposicion", amount: 28000, date: "2026-03-13", products: ["Cable USB-C 2m", "Protector Pantalla 9H"] },
];

export const mockSalesKPIs = {
  totalOrders: 18,
  totalRevenue: 890000,
  atribuidas: 8,
  montoAtribuido: 345000,
  streak: 5,
};

// --- Datos / Sync ---

export const mockSyncLogs = [
  { id: "s1", source: "contabilium", type: "incremental", status: "success", customers: 3, products: 0, orders: 5, timestamp: "2026-03-19T05:12:00Z" },
  { id: "s2", source: "contabilium", type: "incremental", status: "success", customers: 1, products: 2, orders: 8, timestamp: "2026-03-18T05:10:00Z" },
  { id: "s3", source: "upload", type: "full", status: "success", customers: 12, products: 0, orders: 0, timestamp: "2026-03-17T14:30:00Z" },
];

export const mockDataCounts = {
  clientes: 45,
  productos: 128,
  pedidos: 1247,
  predicciones: 312,
};

// --- Asesor Chat ---

export const mockChatMessages = [
  { role: "user" as const, content: "Quien es mi mejor cliente?" },
  { role: "assistant" as const, content: "Tu mejor cliente es **Electronica Sur** con $845,000 en compras totales. Compra en promedio cada 18 dias y su ultimo pedido fue hace 4 dias. Es un cliente muy activo — te recomiendo mantenerlo como cuenta clave." },
  { role: "user" as const, content: "Que producto se vende mas?" },
  { role: "assistant" as const, content: "El producto mas vendido es el **Protector Pantalla 9H** con 300 unidades en stock y alta rotacion. Le siguen los **Cables USB-C 2m** (200 unidades) y las **Fundas Transparentes** (180 unidades). Los tres son productos de entrada que generan recompra frecuente." },
];
