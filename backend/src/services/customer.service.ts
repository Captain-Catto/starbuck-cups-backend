import { Op } from "sequelize";
import { sequelize } from "../config/database";
import { models } from "../models";
import { ServiceError } from "../utils/service-error";

const { Customer, CustomerPhone, CustomerAddress, AdminUser, Order, OrderItem, Product } = models;

const CUSTOMER_FULL_INCLUDE = [
  { model: AdminUser, as: "createdByAdmin", attributes: ["username", "email"] },
  { model: CustomerPhone, as: "customerPhones", attributes: ["id", "phoneNumber", "isMain"] },
  { model: CustomerAddress, as: "addresses", order: [["isDefault", "DESC"]] } as any,
];

export async function findCustomers(filters: {
  page?: string | number;
  limit?: string | number;
  search?: string;
  vipStatus?: string;
  dateFrom?: string;
  dateTo?: string;
}) {
  const { page = "1", limit = "20", search = "", vipStatus = "all", dateFrom, dateTo } = filters;
  const pageNum = parseInt(String(page));
  const limitNum = parseInt(String(limit));
  const offset = (pageNum - 1) * limitNum;

  const where: any = {};
  const hasPhoneSearch = Boolean(search);

  if (search) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { messengerId: { [Op.like]: `%${search}%` } },
      { zaloId: { [Op.like]: `%${search}%` } },
      ...(hasPhoneSearch ? [{ "$customerPhones.phoneNumber$": { [Op.like]: `%${search}%` } }] : []),
    ];
  }
  if (vipStatus === "vip") where.isVip = true;
  else if (vipStatus === "regular") where.isVip = false;

  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt[Op.gte] = new Date(dateFrom);
    if (dateTo) {
      const end = new Date(dateTo);
      end.setDate(end.getDate() + 1);
      where.createdAt[Op.lt] = end;
    }
  }

  const { count: totalCount, rows: customers } = await Customer.findAndCountAll({
    where,
    include: [
      ...CUSTOMER_FULL_INCLUDE,
      { model: Order, as: "orders", limit: 1, order: [["createdAt", "DESC"]], attributes: ["createdAt"] },
    ],
    order: [["createdAt", "DESC"]],
    offset,
    limit: limitNum,
    subQuery: false,
    distinct: true,
  });

  const customersWithData = await Promise.all(
    customers.map(async (customer) => {
      const totalAmount = await Order.sum("totalAmount", { where: { customerId: customer.id, status: "DELIVERED" } });
      return {
        ...customer.toJSON(),
        lastOrderDate: customer.orders?.[0]?.createdAt ?? null,
        totalSpent: totalAmount || 0,
        _count: { orders: customer.orders?.length ?? 0 },
      };
    })
  );

  const totalPages = Math.ceil(totalCount / limitNum);
  return {
    items: customersWithData,
    pagination: {
      current_page: pageNum,
      per_page: limitNum,
      total_pages: totalPages,
      total_items: totalCount,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1,
    },
  };
}

export async function findCustomerById(id: string) {
  const customer = await Customer.findByPk(id, {
    include: [
      ...CUSTOMER_FULL_INCLUDE,
      {
        model: Order,
        as: "orders",
        include: [{ model: OrderItem, as: "items", include: [{ model: Product, as: "product", attributes: ["name", "slug"] }] }],
        order: [["createdAt", "DESC"]],
        limit: 10,
      },
    ],
  });
  if (!customer) throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  return customer;
}

export async function createCustomer(data: {
  messengerId?: string | null;
  zaloId?: string | null;
  fullName: string;
  phoneNumber: string;
  notes?: string | null;
  isVip?: boolean;
  address?: {
    addressLine: string;
    ward?: string | null;
    district?: string | null;
    city: string;
    postalCode?: string | null;
    isDefault?: boolean;
  };
}, adminId: string) {
  return sequelize.transaction(async (t) => {
    const customer = await Customer.create(
      {
        messengerId: data.messengerId || undefined,
        zaloId: data.zaloId || undefined,
        fullName: data.fullName,
        notes: data.notes || undefined,
        isVip: data.isVip || false,
        createdByAdminId: adminId,
      },
      { transaction: t }
    );

    await CustomerPhone.create({ customerId: customer.id, phoneNumber: data.phoneNumber, isMain: true }, { transaction: t });

    if (data.address) {
      await CustomerAddress.create(
        {
          customerId: customer.id,
          addressLine: data.address.addressLine,
          ward: data.address.ward || undefined,
          district: data.address.district || undefined,
          city: data.address.city,
          postalCode: data.address.postalCode || undefined,
          isDefault: data.address.isDefault ?? true,
        },
        { transaction: t }
      );
    }

    return Customer.findByPk(customer.id, { include: CUSTOMER_FULL_INCLUDE, transaction: t });
  });
}

export async function updateCustomer(id: string, data: {
  messengerId?: string | null;
  zaloId?: string | null;
  fullName?: string;
  phoneNumber?: string;
  notes?: string;
  isVip?: boolean;
}) {
  const existing = await Customer.findByPk(id);
  if (!existing) throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

  const updateData: any = {};
  if (data.messengerId !== undefined) updateData.messengerId = data.messengerId || undefined;
  if (data.zaloId !== undefined) updateData.zaloId = data.zaloId || undefined;
  if (data.fullName !== undefined) updateData.fullName = data.fullName;
  if (data.notes !== undefined) updateData.notes = data.notes || undefined;
  if (data.isVip !== undefined) updateData.isVip = data.isVip;

  await sequelize.transaction(async (t) => {
    await existing.update(updateData, { transaction: t });

    if (data.phoneNumber !== undefined) {
      const mainPhone = await CustomerPhone.findOne({ where: { customerId: id, isMain: true }, transaction: t });
      if (mainPhone) {
        await mainPhone.update({ phoneNumber: data.phoneNumber }, { transaction: t });
      } else {
        await CustomerPhone.create({ customerId: id, phoneNumber: data.phoneNumber, isMain: true }, { transaction: t });
      }
    }
  });

  return Customer.findByPk(id, { include: CUSTOMER_FULL_INCLUDE });
}

export async function deleteCustomer(id: string) {
  const customer = await Customer.findByPk(id);
  if (!customer) throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
  await customer.destroy();
}

export async function addAddress(customerId: string, data: {
  addressLine: string;
  ward?: string;
  district?: string;
  city: string;
  postalCode?: string;
  isDefault?: boolean;
}) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

  if (data.isDefault) {
    await CustomerAddress.update({ isDefault: false }, { where: { customerId } });
  }

  return CustomerAddress.create({
    customerId,
    addressLine: data.addressLine,
    ward: data.ward,
    district: data.district,
    city: data.city,
    postalCode: data.postalCode,
    isDefault: data.isDefault ?? false,
  });
}

export async function updateAddress(addressId: string, data: {
  addressLine: string;
  ward?: string;
  district?: string;
  city: string;
  postalCode?: string;
  isDefault?: boolean;
}) {
  const address = await CustomerAddress.findByPk(addressId);
  if (!address) throw new ServiceError(404, "ADDRESS_NOT_FOUND", "Address not found");

  if (data.isDefault) {
    await CustomerAddress.update({ isDefault: false }, { where: { customerId: address.customerId } });
  }

  await address.update(data);
  return address;
}

export async function deleteAddress(addressId: string) {
  const address = await CustomerAddress.findByPk(addressId);
  if (!address) throw new ServiceError(404, "ADDRESS_NOT_FOUND", "Address not found");

  const orderWithAddress = await Order.findOne({
    where: {
      [Op.or]: [
        { "deliveryAddress.addressLine": address.addressLine },
        { customerId: address.customerId },
      ],
    },
  });
  if (orderWithAddress) {
    throw new ServiceError(409, "ADDRESS_IN_USE", "Cannot delete address that is being used in orders");
  }

  await address.destroy();
}

export async function setDefaultAddress(addressId: string) {
  const address = await CustomerAddress.findByPk(addressId);
  if (!address) throw new ServiceError(404, "ADDRESS_NOT_FOUND", "Address not found");

  await CustomerAddress.update({ isDefault: false }, { where: { customerId: address.customerId } });
  await address.update({ isDefault: true });
  return address;
}

export async function findCustomerOrders(customerId: string, filters: {
  page?: string | number;
  limit?: string | number;
  status?: string;
}) {
  const customer = await Customer.findByPk(customerId);
  if (!customer) throw new ServiceError(404, "CUSTOMER_NOT_FOUND", "Customer not found");

  const { page = "1", limit = "10", status = "all" } = filters;
  const pageNum = parseInt(String(page));
  const limitNum = parseInt(String(limit));
  const offset = (pageNum - 1) * limitNum;

  const where: any = { customerId };
  if (status !== "all") where.status = status;

  const { count: totalCount, rows: orders } = await Order.findAndCountAll({
    where,
    include: [{
      model: OrderItem,
      as: "items",
      include: [{ model: Product, as: "product", attributes: ["id", "name", "slug", "unitPrice"] }],
    }],
    order: [["createdAt", "DESC"]],
    offset,
    limit: limitNum,
  });

  const totalPages = Math.ceil(totalCount / limitNum);
  return {
    items: orders,
    pagination: {
      current_page: pageNum,
      per_page: limitNum,
      total_pages: totalPages,
      total_items: totalCount,
      has_next: pageNum < totalPages,
      has_prev: pageNum > 1,
    },
  };
}

export async function findCustomersForSelect(search: string) {
  const hasSearch = Boolean(search);
  const where: any = {};
  if (search) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      ...(hasSearch ? [{ "$customerPhones.phoneNumber$": { [Op.like]: `%${search}%` } }] : []),
    ];
  }

  return Customer.findAll({
    where,
    attributes: ["id", "fullName", "isVip"],
    include: [{ model: CustomerPhone, as: "customerPhones", attributes: ["id", "phoneNumber", "isMain"], required: hasSearch }],
    order: [["fullName", "ASC"]],
    limit: 50,
    subQuery: false,
  });
}

export async function searchCustomers(query: string) {
  const hasQuery = Boolean(query);
  const where: any = {};
  if (query) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${query}%` } },
      { messengerId: { [Op.like]: `%${query}%` } },
      ...(hasQuery ? [{ "$customerPhones.phoneNumber$": { [Op.like]: `%${query}%` } }] : []),
    ];
  }

  return Customer.findAll({
    where,
    attributes: ["id", "fullName", "messengerId"],
    include: [{ model: CustomerPhone, as: "customerPhones", attributes: ["id", "phoneNumber", "isMain"], required: hasQuery }],
    order: [["fullName", "ASC"]],
    limit: 50,
    subQuery: false,
  });
}
