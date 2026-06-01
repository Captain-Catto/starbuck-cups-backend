import { Op } from "sequelize";
import { models } from "../models";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { ServiceError } from "../utils/service-error";

const { Color, AdminUser, ProductColor, Product } = models;

const COLOR_ADMIN_INCLUDE = [
  { model: AdminUser, as: "createdByAdmin", attributes: ["username", "email"] },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ColorFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: string | boolean;
  sortBy?: string;
  sortOrder?: string;
}

function buildColorWhere(filters: ColorFilters) {
  const { search, isActive } = filters;
  const where: any = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
      { hexCode: { [Op.like]: `%${search}%` } },
    ];
  }
  if (isActive !== undefined && isActive !== "all") {
    where.isActive = isActive === "true" || isActive === true;
  }
  return where;
}

export async function findColors(filters: ColorFilters) {
  const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = filters;
  const where = buildColorWhere(filters);
  const offset = (page - 1) * limit;

  const { count: total, rows: colors } = await Color.findAndCountAll({
    where,
    offset,
    limit,
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: COLOR_ADMIN_INCLUDE,
  });

  const totalPages = Math.ceil(total / limit);
  return {
    items: colors,
    pagination: {
      current_page: page,
      per_page: limit,
      total_pages: totalPages,
      total_items: total,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}

export async function findColorsForAdmin(filters: ColorFilters) {
  const { page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = filters;
  const where = buildColorWhere(filters);
  const offset = (page - 1) * limit;

  const queryOptions: any = {
    where,
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      ...COLOR_ADMIN_INCLUDE,
      { model: ProductColor, as: "productColors", attributes: ["id"] },
    ],
    distinct: true,
  };
  if (limit !== -1) {
    queryOptions.offset = offset;
    queryOptions.limit = limit;
  }

  const { count: total, rows: colors } = await Color.findAndCountAll(queryOptions);

  const items = colors.map((c: any) => ({
    ...c.toJSON(),
    _count: { productColors: c.productColors?.length ?? 0 },
  }));

  const totalPages = limit !== -1 ? Math.ceil(total / limit) : 1;
  return {
    items,
    pagination: {
      current_page: page,
      per_page: limit !== -1 ? limit : total,
      total_pages: totalPages,
      total_items: total,
      has_next: limit !== -1 ? page < totalPages : false,
      has_prev: page > 1,
    },
  };
}

export async function findColorById(id: string) {
  const color = await Color.findByPk(id, { include: COLOR_ADMIN_INCLUDE });
  if (!color) throw new ServiceError(404, "COLOR_NOT_FOUND", "Color not found");
  return color;
}

export async function createColor(data: { name: string; slug?: string; hexCode: string }, adminId: string) {
  const { name, slug, hexCode } = data;
  const finalSlug = slug || generateVietnameseSlug(name);

  const [slugConflict, hexConflict] = await Promise.all([
    Color.findOne({ where: { slug: finalSlug } }),
    Color.findOne({ where: { hexCode } }),
  ]);
  if (slugConflict) throw new ServiceError(409, "SLUG_EXISTS", "Color with this slug already exists");
  if (hexConflict) throw new ServiceError(409, "HEX_CODE_EXISTS", "Color with this hex code already exists");

  const color = await Color.create({ name, slug: finalSlug, hexCode, isActive: true, createdByAdminId: adminId });
  return Color.findByPk(color.id, { include: COLOR_ADMIN_INCLUDE });
}

export async function updateColor(id: string, data: { name?: string; slug?: string; hexCode?: string }) {
  const existing = await Color.findByPk(id);
  if (!existing) throw new ServiceError(404, "COLOR_NOT_FOUND", "Color not found");

  if (data.name && !data.slug) data.slug = generateVietnameseSlug(data.name);

  if (data.slug) {
    const conflict = await Color.findOne({ where: { slug: data.slug, id: { [Op.ne]: id } } });
    if (conflict) throw new ServiceError(409, "SLUG_EXISTS", "Color with this slug already exists");
  }
  if (data.hexCode) {
    const conflict = await Color.findOne({ where: { hexCode: data.hexCode, id: { [Op.ne]: id } } });
    if (conflict) throw new ServiceError(409, "HEX_CODE_EXISTS", "Color with this hex code already exists");
  }

  await existing.update(data);
  return Color.findByPk(id, { include: COLOR_ADMIN_INCLUDE });
}

export async function deleteColor(id: string) {
  const color = await Color.findByPk(id);
  if (!color) throw new ServiceError(404, "COLOR_NOT_FOUND", "Color not found");

  const productCount = await ProductColor.count({ where: { colorId: id } });
  if (productCount > 0) {
    throw new ServiceError(409, "COLOR_IN_USE", "Cannot delete color that is being used by products");
  }

  await color.destroy();
}

export async function toggleColorStatus(id: string) {
  const color = await Color.findByPk(id);
  if (!color) throw new ServiceError(404, "COLOR_NOT_FOUND", "Color not found");
  await color.update({ isActive: !color.isActive });
  return Color.findByPk(id, { include: COLOR_ADMIN_INCLUDE });
}

export async function findActiveColors() {
  return Color.findAll({
    where: { isActive: true },
    order: [["name", "ASC"]],
    attributes: ["id", "name", "slug", "hexCode"],
  });
}

export async function searchColors(query: string, active: boolean) {
  const where: any = { isActive: active };
  if (query) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query}%` } },
      { slug: { [Op.like]: `%${query}%` } },
      { hexCode: { [Op.like]: `%${query}%` } },
    ];
  }
  return Color.findAll({ where, attributes: ["id", "name", "slug", "hexCode"], order: [["name", "ASC"]], limit: 50 });
}

export async function findPublicColorByIdOrSlug(idOrSlug: string) {
  const isUUID = UUID_RE.test(idOrSlug);
  const where: any = { isActive: true };
  if (isUUID) {
    where[Op.or] = [{ id: idOrSlug }, { slug: idOrSlug }];
  } else {
    where.slug = idOrSlug;
  }

  const ATTRS = ["id", "name", "slug", "hexCode", "isActive", "createdAt", "updatedAt"];
  const color = await Color.findOne({
    where,
    attributes: ATTRS,
    include: [{
      model: ProductColor,
      as: "productColors",
      attributes: [],
      include: [{ model: Product, as: "product", where: { isActive: true }, attributes: [], required: false }],
      required: false,
    }],
  });
  if (!color) throw new ServiceError(404, "COLOR_NOT_FOUND", "Color not found");
  return color;
}

export async function findPublicColors(filters: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }) {
  const { page = 1, limit = 50, search, sortBy = "name", sortOrder = "asc" } = filters;
  const where: any = { isActive: true };
  if (search) where.name = { [Op.like]: `%${search}%` };

  const orderField = sortBy === "createdAt" ? "createdAt" : "name";
  const ATTRS = ["id", "name", "slug", "hexCode", "isActive", "createdAt", "updatedAt"];

  const queryOptions: any = {
    where,
    attributes: ATTRS,
    include: [{
      model: ProductColor,
      as: "productColors",
      attributes: [],
      include: [{ model: Product, as: "product", where: { isActive: true }, attributes: [], required: false }],
      required: false,
    }],
    order: [[orderField, sortOrder.toUpperCase()]],
    distinct: true,
  };
  if (limit !== -1) {
    queryOptions.offset = (page - 1) * limit;
    queryOptions.limit = limit;
  }

  const { count: totalItems, rows: items } = await Color.findAndCountAll(queryOptions);
  const totalPages = limit !== -1 ? Math.ceil(totalItems / limit) : 1;

  return {
    items,
    pagination: {
      current_page: page,
      per_page: limit,
      total_pages: totalPages,
      total_items: totalItems,
      has_next: page < totalPages,
      has_prev: page > 1,
    },
  };
}
