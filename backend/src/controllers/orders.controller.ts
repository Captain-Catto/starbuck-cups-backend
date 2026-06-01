import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import * as orderService from "../services/order.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const createOrderItemSchema = z.object({
  productId: z.string().uuid("Invalid product ID"),
  quantity: z.coerce.number().int().positive("Quantity must be positive"),
  unitPrice: z.coerce.number().nonnegative().optional(),
  requestedColor: z.string().optional(),
  updateBasePrice: z.boolean().optional(),
});

const createOrderSchema = z
  .object({
    customerId: z.string().uuid("Invalid customer ID"),
    orderType: z.enum(["custom", "product"]),
    deliveryAddress: z.object({
      addressLine: z.string().min(1, "Address line is required"),
      district: z.string().optional(),
      city: z.string().min(1, "City is required"),
      postalCode: z.string().optional(),
    }),
    customDescription: z.string().optional(),
    totalAmount: z.coerce.number().nonnegative().optional(),
    notes: z.string().optional(),
    items: z.array(createOrderItemSchema).optional(),
    originalShippingCost: z.number().nonnegative().optional(),
    shippingDiscount: z.number().nonnegative().optional(),
    shippingCost: z.number().nonnegative().optional(),
  })
  .refine(
    (data) => !(data.orderType === "product" && (!data.items || data.items.length === 0)),
    { message: "Items are required for product orders" }
  )
  .refine(
    (data) => !(data.orderType === "custom" && !data.customDescription),
    { message: "Description is required for custom orders" }
  )
  .refine(
    (data) => !(data.shippingDiscount !== undefined && data.originalShippingCost !== undefined && data.shippingDiscount > data.originalShippingCost),
    { message: "Shipping discount cannot exceed original shipping cost" }
  );

const updateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"]),
  notes: z.string().optional(),
});

const updateOrderSchema = z.object({
  paymentMethod: z.enum(["cash", "credit_card", "debit_card", "bank_transfer", "momo", "zalopay"]).optional(),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    phoneNumber: z.string().min(1),
    addressLine1: z.string().min(1),
    addressLine2: z.string().optional(),
    district: z.string().optional(),
    city: z.string().min(1),
    postalCode: z.string().optional(),
  }).optional(),
  notes: z.string().optional(),
  orderItems: z.array(z.object({ productId: z.string().uuid(), quantity: z.coerce.number().int().positive() })).optional(),
  originalShippingCost: z.number().nonnegative().optional(),
  shippingDiscount: z.number().nonnegative().optional(),
  shippingCost: z.number().nonnegative().optional(),
});

// ── Error handler helper ──────────────────────────────────────────────────────

function handleError(res: Response, err: unknown, label: string) {
  if (err instanceof ServiceError) {
    return res.status(err.statusCode).json(ResponseHelper.error(err.message, err.code));
  }
  logger.error(`${label}:`, err);
  return res.status(500).json(ResponseHelper.error(`Failed to ${label}`, label.toUpperCase().replace(/ /g, "_") + "_ERROR"));
}

// ── Controllers ───────────────────────────────────────────────────────────────

export const getOrders = async (req: Request, res: Response) => {
  try {
    const result = await orderService.findOrders(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get orders");
  }
};

export const getOrderById = async (req: Request, res: Response) => {
  try {
    const order = await orderService.findOrderById(req.params.id);
    return res.status(200).json(ResponseHelper.success(order));
  } catch (err) {
    return handleError(res, err, "get order");
  }
};

export const createOrder = async (req: Request, res: Response) => {
  const validation = createOrderSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const order = await orderService.createOrder(validation.data);
    return res.status(201).json(ResponseHelper.success(order));
  } catch (err) {
    return handleError(res, err, "create order");
  }
};

export const updateOrderStatus = async (req: Request, res: Response) => {
  const validation = updateOrderStatusSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const order = await orderService.updateOrderStatus(req.params.id, validation.data.status, validation.data.notes);
    return res.status(200).json(ResponseHelper.success(order));
  } catch (err) {
    return handleError(res, err, "update order status");
  }
};

export const deleteOrder = async (req: Request, res: Response) => {
  try {
    await orderService.deleteOrder(req.params.id);
    return res.status(200).json(ResponseHelper.success({ message: "Order deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete order");
  }
};

export const getOrderStats = async (req: Request, res: Response) => {
  try {
    const days = parseInt((req.query.period as string) || "30");
    const stats = await orderService.getOrderStats(days);
    return res.status(200).json(ResponseHelper.success(stats));
  } catch (err) {
    return handleError(res, err, "get order stats");
  }
};

export const updateOrder = async (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  }
  const validation = updateOrderSchema.safeParse(req.body);
  if (!validation.success) {
    return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  }
  try {
    const order = await orderService.updateOrder(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(order));
  } catch (err) {
    return handleError(res, err, "update order");
  }
};

export const getRecentOrders = async (req: Request, res: Response) => {
  try {
    const limit = parseInt((req.query.limit as string) || "10");
    const orders = await orderService.getRecentOrders(limit);
    return res.status(200).json(ResponseHelper.success(orders));
  } catch (err) {
    return handleError(res, err, "get recent orders");
  }
};

// Re-export for backward compatibility (used in other modules)
export { generateOrderNumber } from "../services/order.service";
