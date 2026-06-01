import { Op } from "sequelize";
import { Category, AdminUser, ProductCategory } from "../models";
import { generateVietnameseSlug } from "../utils/vietnamese-slug";
import { ServiceError } from "../utils/service-error";

export interface CategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  parentId?: string;
  sortBy?: string;
  sortOrder?: string;
  includeChildren?: boolean;
}

export interface CreateCategoryData {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string;
  parentId?: string;
}

const CATEGORY_INCLUDES_ADMIN = [
  { model: AdminUser, as: "createdByAdmin", attributes: ["username", "email"] },
  { model: Category, as: "parent", attributes: ["id", "name", "slug"] },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getCategoryDepth(categoryId: string): Promise<number> {
  const category = await Category.findOne({
    where: { id: categoryId },
    attributes: ["parentId"],
  });
  if (!category || !category.parentId) return 1;
  return 1 + (await getCategoryDepth(category.parentId));
}

async function isDescendant(
  categoryId: string,
  potentialAncestorId: string
): Promise<boolean> {
  const cat = await Category.findOne({
    where: { id: categoryId },
    attributes: ["parentId"],
  });
  if (!cat || !cat.parentId) return false;
  if (cat.parentId === potentialAncestorId) return true;
  return isDescendant(cat.parentId, potentialAncestorId);
}

async function generateUniqueSlug(
  base: string,
  excludeId?: string
): Promise<string> {
  let slug = base;
  let counter = 0;
  while (
    await Category.findOne({
      where: { slug, ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}) },
    })
  ) {
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
}

async function validateParent(
  parentId: string,
  selfId?: string
): Promise<void> {
  if (selfId && parentId === selfId) {
    throw new ServiceError(400, "INVALID_PARENT", "Category cannot be its own parent");
  }
  const parent = await Category.findOne({ where: { id: parentId } });
  if (!parent) {
    throw new ServiceError(400, "PARENT_NOT_FOUND", "Parent category not found");
  }
  if (selfId && (await isDescendant(parentId, selfId))) {
    throw new ServiceError(400, "CIRCULAR_REFERENCE", "Cannot create circular parent-child relationship");
  }
  const depth = await getCategoryDepth(parentId);
  if (depth >= 3) {
    throw new ServiceError(400, "MAX_DEPTH_EXCEEDED", "Maximum category depth (3 levels) exceeded");
  }
}

// ── Service methods ───────────────────────────────────────────────────────────

export async function findCategories(filters: CategoryFilters) {
  const {
    page = 1,
    limit = 20,
    search,
    isActive,
    parentId,
    sortBy = "name",
    sortOrder = "asc",
    includeChildren = false,
  } = filters;

  const where: any = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { slug: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }
  if (isActive !== undefined) where.isActive = isActive;
  if (parentId !== undefined) where.parentId = parentId;

  const queryOptions: any = {
    where,
    order: [[sortBy, sortOrder.toUpperCase()]],
    include: [
      ...CATEGORY_INCLUDES_ADMIN,
      ...(includeChildren
        ? [{ model: Category, as: "children", attributes: ["id", "name", "slug", "isActive"], where: { isActive: true } }]
        : []),
    ],
  };

  if (limit !== -1) {
    queryOptions.offset = (page - 1) * limit;
    queryOptions.limit = limit;
  }

  const [total, categories] = await Promise.all([
    Category.count({ where }),
    Category.findAll(queryOptions),
  ]);

  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const productCount = await ProductCategory.count({ where: { categoryId: category.id } });
      return { ...category.toJSON(), _count: { products: productCount } };
    })
  );

  const totalPages = limit !== -1 ? Math.ceil(total / limit) : 1;
  return {
    items: categoriesWithCount,
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

export async function buildCategoryTree(activeOnly: boolean) {
  const where: any = activeOnly ? { isActive: true } : {};
  const categories = await Category.findAll({
    where,
    order: [["name", "ASC"]],
    include: [{ model: Category, as: "children" }],
  });

  const buildTree = (parentId: string | null): any[] =>
    categories
      .filter((cat) => cat.parentId === parentId)
      .map((cat) => ({ ...cat, children: buildTree(cat.id) }));

  return buildTree(null);
}

export async function findCategoryById(id: string) {
  const category = await Category.findOne({
    where: { id },
    include: [
      ...CATEGORY_INCLUDES_ADMIN,
      { model: Category, as: "children", attributes: ["id", "name", "slug", "isActive"] },
    ],
  });
  if (!category) throw new ServiceError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return category;
}

export async function createCategory(data: CreateCategoryData, adminId: string) {
  const { name, slug, description, parentId } = data;

  const baseSlug = slug || generateVietnameseSlug(name);
  const finalSlug = await generateUniqueSlug(baseSlug);

  if (parentId) await validateParent(parentId);

  const category = await Category.create({
    name: name.trim(),
    slug: finalSlug,
    description: description?.trim(),
    parentId,
    isActive: true,
    createdByAdminId: adminId,
  });

  return Category.findOne({
    where: { id: category.id },
    include: [...CATEGORY_INCLUDES_ADMIN],
  });
}

export async function updateCategory(id: string, data: UpdateCategoryData) {
  const existing = await Category.findOne({ where: { id } });
  if (!existing) throw new ServiceError(404, "CATEGORY_NOT_FOUND", "Category not found");

  if (data.parentId !== undefined) {
    if (data.parentId) await validateParent(data.parentId, id);
  }

  if (data.name && !data.slug) {
    data.slug = generateVietnameseSlug(data.name);
  }

  if (data.slug && data.slug !== existing.slug) {
    data.slug = await generateUniqueSlug(data.slug, id);
  }

  const processedData: any = {};
  if (data.name) processedData.name = data.name.trim();
  if (data.slug) processedData.slug = data.slug;
  if (data.description !== undefined) processedData.description = data.description?.trim() || null;
  if (data.parentId !== undefined) processedData.parentId = data.parentId;

  await Category.update(processedData, { where: { id } });

  return Category.findOne({
    where: { id },
    include: [
      ...CATEGORY_INCLUDES_ADMIN,
      { model: Category, as: "children", attributes: ["id", "name", "slug", "isActive"] },
    ],
  });
}

export async function toggleCategoryStatus(id: string) {
  const category = await Category.findOne({
    where: { id },
    include: [{ model: Category, as: "children" }],
  });
  if (!category) throw new ServiceError(404, "CATEGORY_NOT_FOUND", "Category not found");

  await Category.update({ isActive: !category.isActive }, { where: { id } });

  return Category.findOne({
    where: { id },
    include: [...CATEGORY_INCLUDES_ADMIN],
  });
}

export async function deleteCategory(id: string) {
  const category = await Category.findOne({
    where: { id },
    include: [{ model: Category, as: "children" }],
  });
  if (!category) throw new ServiceError(404, "CATEGORY_NOT_FOUND", "Category not found");

  const childrenCount = category.children?.length ?? 0;
  const productCount = await ProductCategory.count({ where: { categoryId: id } });

  if (childrenCount > 0 || productCount > 0) {
    throw new ServiceError(
      409,
      "CATEGORY_IN_USE",
      `Không thể xoá danh mục đang được sử dụng bởi ${productCount} sản phẩm và ${childrenCount} danh mục con. Hãy xem xét việc tắt danh mục thay vì xoá.`
    );
  }

  await Category.destroy({ where: { id } });
}

export async function searchCategories(query: string, active: boolean, parentId?: string) {
  const where: any = { isActive: active };
  if (query) {
    where[Op.or] = [
      { name: { [Op.like]: `%${query}%` } },
      { slug: { [Op.like]: `%${query}%` } },
    ];
  }
  if (parentId) where.parentId = parentId;

  return Category.findAll({
    where,
    attributes: ["id", "name", "slug", "parentId"],
    include: [{ model: Category, as: "parent", attributes: ["name"] }],
    order: [["name", "ASC"]],
    limit: 50,
  });
}

export async function findPublicCategories(filters: {
  page?: number;
  limit?: number;
  search?: string;
  parentId?: string;
  sortBy?: string;
  sortOrder?: string;
}) {
  const { page = 1, limit = 20, search, parentId, sortBy = "name", sortOrder = "asc" } = filters;
  const where: any = { isActive: true };
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }
  if (parentId !== undefined) where.parentId = parentId;

  const [items, totalItems] = await Promise.all([
    Category.findAll({
      where,
      attributes: ["id", "name", "slug", "description", "parentId", "isActive", "createdAt", "updatedAt"],
      include: [
        { model: Category, as: "parent", attributes: ["id", "name", "slug", "isActive"] },
        { model: Category, as: "children", where: { isActive: true }, required: false, attributes: ["id", "name", "slug", "isActive"] },
      ],
      order: [[sortBy, sortOrder.toUpperCase()]],
      offset: (page - 1) * limit,
      limit,
    }),
    Category.count({ where }),
  ]);

  const totalPages = Math.ceil(totalItems / limit);
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

export async function findPublicCategoryTree() {
  const ACTIVE_CHILDREN = { model: Category, as: "children", where: { isActive: true }, required: false };
  const ATTRS = ["id", "name", "slug", "description", "parentId", "isActive", "createdAt", "updatedAt"];

  return Category.findAll({
    where: { isActive: true, parentId: { [Op.is]: null } } as any,
    attributes: ATTRS,
    include: [
      {
        ...ACTIVE_CHILDREN,
        attributes: ATTRS,
        include: [{ ...ACTIVE_CHILDREN, attributes: ATTRS }],
      },
    ],
    order: [["name", "ASC"]],
  });
}

export async function findPublicCategoryByIdOrSlug(idOrSlug: string) {
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
  const whereClause = isUUID
    ? { [Op.or]: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true }
    : { slug: idOrSlug, isActive: true };

  const ATTRS = ["id", "name", "slug", "description", "parentId", "isActive", "createdAt", "updatedAt"];
  const category = await Category.findOne({
    where: whereClause,
    attributes: ATTRS,
    include: [
      { model: Category, as: "parent", attributes: ["id", "name", "slug", "isActive"] },
      { model: Category, as: "children", where: { isActive: true }, required: false, attributes: ["id", "name", "slug", "isActive"] },
    ],
  });
  if (!category) throw new ServiceError(404, "CATEGORY_NOT_FOUND", "Category not found");
  return category;
}
