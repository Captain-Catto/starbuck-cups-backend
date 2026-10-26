/**
 * Permission catalog for the admin area. Roles are sets of these keys (stored in
 * admin_role_permissions); the catalog itself lives in code so routes can reference it.
 */

export interface PermissionDefinition {
  key: string;
  module: string;
  label: string;
  // Only the built-in SUPER_ADMIN role may hold these, so a role editor cannot grant itself more power
  superOnly?: boolean;
}

export const PERMISSION_MODULES: Record<string, string> = {
  dashboard: "Tổng quan & thống kê",
  products: "Sản phẩm",
  catalog: "Danh mục, màu sắc, dung tích",
  orders: "Đơn hàng",
  customers: "Khách hàng",
  consultations: "Tư vấn",
  news: "Tin tức",
  hero_images: "Hero images",
  banners: "Banner quảng cáo",
  settings: "Cấu hình",
  accounts: "Tài khoản & phân quyền",
};

export const PERMISSIONS = {
  DASHBOARD_VIEW: "dashboard.view",
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_MANAGE: "products.manage",
  PRODUCTS_STOCK: "products.stock",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  ORDERS_VIEW: "orders.view",
  ORDERS_MANAGE: "orders.manage",
  CUSTOMERS_VIEW: "customers.view",
  CUSTOMERS_MANAGE: "customers.manage",
  CONSULTATIONS_VIEW: "consultations.view",
  CONSULTATIONS_MANAGE: "consultations.manage",
  NEWS_VIEW: "news.view",
  NEWS_MANAGE: "news.manage",
  HERO_IMAGES_VIEW: "hero_images.view",
  HERO_IMAGES_MANAGE: "hero_images.manage",
  BANNERS_VIEW: "banners.view",
  BANNERS_MANAGE: "banners.manage",
  SETTINGS_MANAGE: "settings.manage",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { key: PERMISSIONS.DASHBOARD_VIEW, module: "dashboard", label: "Xem tổng quan và thống kê" },
  { key: PERMISSIONS.PRODUCTS_VIEW, module: "products", label: "Xem sản phẩm" },
  { key: PERMISSIONS.PRODUCTS_MANAGE, module: "products", label: "Thêm, sửa, xóa, ghim sản phẩm" },
  { key: PERMISSIONS.PRODUCTS_STOCK, module: "products", label: "Cập nhật tồn kho" },
  { key: PERMISSIONS.CATALOG_VIEW, module: "catalog", label: "Xem danh mục, màu sắc, dung tích" },
  { key: PERMISSIONS.CATALOG_MANAGE, module: "catalog", label: "Quản lý danh mục, màu sắc, dung tích" },
  { key: PERMISSIONS.ORDERS_VIEW, module: "orders", label: "Xem đơn hàng" },
  { key: PERMISSIONS.ORDERS_MANAGE, module: "orders", label: "Tạo, sửa, xóa đơn hàng" },
  { key: PERMISSIONS.CUSTOMERS_VIEW, module: "customers", label: "Xem khách hàng" },
  { key: PERMISSIONS.CUSTOMERS_MANAGE, module: "customers", label: "Quản lý khách hàng" },
  { key: PERMISSIONS.CONSULTATIONS_VIEW, module: "consultations", label: "Xem yêu cầu tư vấn" },
  { key: PERMISSIONS.CONSULTATIONS_MANAGE, module: "consultations", label: "Xử lý, xóa yêu cầu tư vấn" },
  { key: PERMISSIONS.NEWS_VIEW, module: "news", label: "Xem tin tức" },
  { key: PERMISSIONS.NEWS_MANAGE, module: "news", label: "Quản lý tin tức" },
  { key: PERMISSIONS.HERO_IMAGES_VIEW, module: "hero_images", label: "Xem hero images" },
  { key: PERMISSIONS.HERO_IMAGES_MANAGE, module: "hero_images", label: "Quản lý hero images" },
  { key: PERMISSIONS.BANNERS_VIEW, module: "banners", label: "Xem banner quảng cáo" },
  { key: PERMISSIONS.BANNERS_MANAGE, module: "banners", label: "Quản lý banner quảng cáo" },
  { key: PERMISSIONS.SETTINGS_MANAGE, module: "settings", label: "Thay đổi cấu hình" },
  { key: PERMISSIONS.USERS_MANAGE, module: "accounts", label: "Quản lý tài khoản", superOnly: true },
  { key: PERMISSIONS.ROLES_MANAGE, module: "accounts", label: "Quản lý vai trò và quyền", superOnly: true },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.map((p) => p.key);
export const GRANTABLE_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.filter((p) => !p.superOnly).map((p) => p.key);

/** Keys of the three built-in roles. SUPER_ADMIN always holds every permission. */
export const SYSTEM_ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "STAFF"] as const;
export type SystemRoleKey = (typeof SYSTEM_ROLE_KEYS)[number];

export interface SystemRoleDefinition {
  key: SystemRoleKey;
  name: string;
  description: string;
  permissions: string[];
}

// ADMIN: everything except account management and configuration
const ADMIN_PERMISSIONS = ALL_PERMISSION_KEYS.filter(
  (key) => key !== PERMISSIONS.USERS_MANAGE && key !== PERMISSIONS.ROLES_MANAGE && key !== PERMISSIONS.SETTINGS_MANAGE
);

// STAFF mirrors what a staff account could do before roles became configurable
const STAFF_PERMISSIONS: string[] = [
  PERMISSIONS.PRODUCTS_VIEW,
  PERMISSIONS.PRODUCTS_STOCK,
  PERMISSIONS.CATALOG_VIEW,
  PERMISSIONS.ORDERS_VIEW,
  PERMISSIONS.CUSTOMERS_VIEW,
  PERMISSIONS.CONSULTATIONS_VIEW,
  PERMISSIONS.CONSULTATIONS_MANAGE,
  PERMISSIONS.HERO_IMAGES_VIEW,
];

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Toàn quyền, kể cả quản lý tài khoản và cấu hình", permissions: ALL_PERMISSION_KEYS },
  { key: "ADMIN", name: "Quản trị viên", description: "Quản lý mọi nội dung, trừ tài khoản và cấu hình", permissions: ADMIN_PERMISSIONS },
  { key: "STAFF", name: "Nhân viên", description: "Xem dữ liệu, xử lý tư vấn và cập nhật tồn kho", permissions: STAFF_PERMISSIONS },
];
