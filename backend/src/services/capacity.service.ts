import { Op } from "sequelize";
import { models } from "../models";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { ServiceError } from "../utils/service-error";

const { Capacity, AdminUser, Product } = models;

const CAPACITY_ADMIN_INCLUDE = [
  { model: AdminUser, as: "createdByAdmin", attributes: ["username", "email"] },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CapacityFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

export async function findCapacities(filters: CapacityFilters) {
  const { page = 1, limit = 20, search, isActive, sortBy = "volumeMl", sortOrder = "asc" } = filters;
  const where: any = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive;

  const [total, capacities] = await Promise.all([
    Capacity.count({ where }),
    Capacity.findAll({ where, offset: (page - 1) * limit, limit, order: [[sortBy, sortOrder.toUpperCase()]], include: CAPACITY_ADMIN_INCLUDE }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return {
    items: capacities,
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

export async function findCapacitiesForAdmin(filters: CapacityFilters) {
  const { page = 1, limit = 20, search, isActive, sortBy = "volumeMl", sortOrder = "asc" } = filters;
  const where: any = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive;

  const queryOptions: any = {
    where,
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: CAPACITY_ADMIN_INCLUDE,
    distinct: true,
  };
  if (limit !== -1) {
    queryOptions.offset = (page - 1) * limit;
    queryOptions.limit = limit;
  }

  const { count: total, rows: capacities } = await Capacity.findAndCountAll(queryOptions);

  const items = await Promise.all(
    capacities.map(async (capacity) => {
      const productCount = await Product.count({ where: { capacityId: capacity.id } });
      return { ...capacity.toJSON(), _count: { products: productCount } };
    })
  );

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

export async function findCapacityById(id: string) {
  const capacity = await Capacity.findOne({ where: { id }, include: CAPACITY_ADMIN_INCLUDE });
  if (!capacity) throw new ServiceError(404, "CAPACITY_NOT_FOUND", "Capacity not found");
  return capacity;
}

export async function createCapacity(data: { name: string; slug?: string; volumeMl: number }, adminId: string) {
  const { name, slug, volumeMl } = data;
  const finalSlug = slug || generateVietnameseSlug(name);

  const existing = await Capacity.findOne({
    where: { [Op.or]: [{ name: { [Op.like]: name } }, { slug: { [Op.like]: finalSlug } }, { volumeMl }] },
  });

  if (existing) {
    let field = "volume";
    if (existing.name.toLowerCase() === name.toLowerCase()) field = "name";
    else if (existing.slug?.toLowerCase() === finalSlug.toLowerCase()) field = "slug";
    throw new ServiceError(409, "DUPLICATE_CAPACITY", `Capacity with this ${field} already exists`);
  }

  const capacity = await Capacity.create({ name: name.trim(), slug: finalSlug, volumeMl, isActive: true, createdByAdminId: adminId });
  return Capacity.findOne({ where: { id: capacity.id }, include: CAPACITY_ADMIN_INCLUDE });
}

export async function updateCapacity(id: string, data: { name?: string; slug?: string; volumeMl?: number }) {
  const existing = await Capacity.findOne({ where: { id } });
  if (!existing) throw new ServiceError(404, "CAPACITY_NOT_FOUND", "Capacity not found");

  if (data.name || data.slug || data.volumeMl) {
    const duplicateWhere: any = { id: { [Op.ne]: id }, [Op.or]: [] };
    if (data.name) duplicateWhere[Op.or].push({ name: { [Op.like]: data.name } });
    if (data.slug) duplicateWhere[Op.or].push({ slug: { [Op.like]: data.slug } });
    if (data.volumeMl) duplicateWhere[Op.or].push({ volumeMl: data.volumeMl });

    const duplicate = await Capacity.findOne({ where: duplicateWhere });
    if (duplicate) {
      let field = "volume";
      if (duplicate.name.toLowerCase() === data.name?.toLowerCase()) field = "name";
      else if (duplicate.slug?.toLowerCase() === data.slug?.toLowerCase()) field = "slug";
      throw new ServiceError(409, "DUPLICATE_CAPACITY", `Capacity with this ${field} already exists`);
    }
  }

  const processedData: any = {};
  if (data.name) {
    processedData.name = data.name.trim();
    if (!data.slug) processedData.slug = generateVietnameseSlug(data.name);
  }
  if (data.slug) processedData.slug = data.slug.trim();
  if (data.volumeMl) processedData.volumeMl = data.volumeMl;

  await Capacity.update(processedData, { where: { id } });
  return Capacity.findOne({ where: { id }, include: CAPACITY_ADMIN_INCLUDE });
}

export async function toggleCapacityStatus(id: string) {
  const capacity = await Capacity.findOne({ where: { id } });
  if (!capacity) throw new ServiceError(404, "CAPACITY_NOT_FOUND", "Capacity not found");
  await Capacity.update({ isActive: !capacity.isActive }, { where: { id } });
  return Capacity.findOne({ where: { id }, include: CAPACITY_ADMIN_INCLUDE });
}

export async function deleteCapacity(id: string) {
  const capacity = await Capacity.findOne({ where: { id } });
  if (!capacity) throw new ServiceError(404, "CAPACITY_NOT_FOUND", "Capacity not found");
  await Capacity.destroy({ where: { id } });
}

export async function searchCapacities(query: string, active: boolean) {
  const where: any = { isActive: active };
  if (query) {
    const numeric = Number(query);
    if (!isNaN(numeric)) {
      where.volumeMl = numeric;
    } else {
      where[Op.or] = [{ name: { [Op.like]: `%${query}%` } }, { slug: { [Op.like]: `%${query}%` } }];
    }
  }
  return Capacity.findAll({ where, attributes: ["id", "name", "slug", "volumeMl"], order: [["volumeMl", "ASC"]], limit: 50 });
}

export async function findPublicCapacityByIdOrSlug(idOrSlug: string) {
  const isUUID = UUID_RE.test(idOrSlug);
  const whereClause = isUUID
    ? { [Op.or]: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true }
    : { slug: idOrSlug, isActive: true };

  const capacity = await Capacity.findOne({
    where: whereClause,
    attributes: ["id", "name", "slug", "volumeMl", "isActive", "createdAt", "updatedAt"],
  });
  if (!capacity) throw new ServiceError(404, "CAPACITY_NOT_FOUND", "Capacity not found");
  return capacity;
}

export async function findPublicCapacities(filters: { page?: number; limit?: number; search?: string; sortBy?: string; sortOrder?: string }) {
  const { page = 1, limit = 50, search, sortBy = "volumeMl", sortOrder = "asc" } = filters;
  const where: any = { isActive: true };
  if (search) where.name = { [Op.like]: `%${search}%` };

  const queryOptions: any = {
    where,
    attributes: ["id", "name", "slug", "volumeMl", "isActive", "createdAt", "updatedAt"],
    order: [[sortBy, sortOrder.toUpperCase()]],
  };
  if (limit !== -1) {
    queryOptions.offset = (page - 1) * limit;
    queryOptions.limit = limit;
  }

  const [items, totalItems] = await Promise.all([Capacity.findAll(queryOptions), Capacity.count({ where })]);
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
