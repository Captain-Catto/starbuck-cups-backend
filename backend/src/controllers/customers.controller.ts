import { logger } from "@/utils/logger";
import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";
import { ServiceError } from "../utils/service-error";
import { z } from "zod";
import { isValidPhoneNumber, getPhoneValidationErrorMessage } from "../utils/phoneValidation";
import * as customerService from "../services/customer.service";

// ── Validation schemas ────────────────────────────────────────────────────────

const createCustomerSchema = z.object({
  messengerId: z.string().nullable().optional(),
  zaloId: z.string().nullable().optional(),
  fullName: z.string().min(1, "Full name is required"),
  phoneNumber: z.string().min(1, "Phone number is required").refine(isValidPhoneNumber, { message: getPhoneValidationErrorMessage() }),
  notes: z.string().nullable().optional(),
  isVip: z.boolean().optional(),
  address: z.object({
    addressLine: z.string().min(1, "Address line is required"),
    ward: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    city: z.string().min(1, "City is required"),
    postalCode: z.string().nullable().optional(),
    isDefault: z.boolean().optional(),
  }).optional(),
});

const updateCustomerSchema = z.object({
  messengerId: z.string().nullable().optional(),
  zaloId: z.string().nullable().optional(),
  fullName: z.string().optional(),
  phoneNumber: z.string().refine(isValidPhoneNumber, { message: getPhoneValidationErrorMessage() }).optional(),
  notes: z.string().optional(),
  isVip: z.boolean().optional(),
});

const createAddressSchema = z.object({
  addressLine: z.string().min(1, "Address line is required"),
  ward: z.string().optional(),
  district: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postalCode: z.string().optional(),
  isDefault: z.boolean().optional(),
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

export const getCustomers = async (req: Request, res: Response) => {
  try {
    const result = await customerService.findCustomers(req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get customers");
  }
};

export const getCustomerById = async (req: Request, res: Response) => {
  try {
    const customer = await customerService.findCustomerById(req.params.id);
    return res.status(200).json(ResponseHelper.success(customer));
  } catch (err) {
    return handleError(res, err, "get customer");
  }
};

export const createCustomer = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createCustomerSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const customer = await customerService.createCustomer(validation.data, req.user.userId);
    return res.status(201).json(ResponseHelper.success(customer));
  } catch (err) {
    return handleError(res, err, "create customer");
  }
};

export const updateCustomer = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = updateCustomerSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const customer = await customerService.updateCustomer(req.params.id, validation.data);
    return res.status(200).json(ResponseHelper.success(customer));
  } catch (err) {
    return handleError(res, err, "update customer");
  }
};

export const deleteCustomer = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await customerService.deleteCustomer(req.params.id);
    return res.status(200).json(ResponseHelper.success({ message: "Customer deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete customer");
  }
};

export const addCustomerAddress = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createAddressSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const address = await customerService.addAddress(req.params.customerId, validation.data);
    return res.status(201).json(ResponseHelper.success(address));
  } catch (err) {
    return handleError(res, err, "add customer address");
  }
};

export const updateCustomerAddress = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  const validation = createAddressSchema.safeParse(req.body);
  if (!validation.success) return res.status(400).json(ResponseHelper.error("Validation failed", "VALIDATION_ERROR", validation.error.issues));
  try {
    const address = await customerService.updateAddress(req.params.addressId, validation.data);
    return res.status(200).json(ResponseHelper.success(address));
  } catch (err) {
    return handleError(res, err, "update customer address");
  }
};

export const deleteCustomerAddress = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    await customerService.deleteAddress(req.params.addressId);
    return res.status(200).json(ResponseHelper.success({ message: "Address deleted successfully" }));
  } catch (err) {
    return handleError(res, err, "delete customer address");
  }
};

export const getCustomerOrders = async (req: Request, res: Response) => {
  try {
    const result = await customerService.findCustomerOrders(req.params.id, req.query);
    return res.status(200).json(ResponseHelper.paginated(result.items, result.pagination));
  } catch (err) {
    return handleError(res, err, "get customer orders");
  }
};

export const setDefaultAddress = async (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json(ResponseHelper.error("Authentication required", "UNAUTHORIZED"));
  try {
    const address = await customerService.setDefaultAddress(req.params.addressId);
    return res.status(200).json(ResponseHelper.success(address));
  } catch (err) {
    return handleError(res, err, "set default address");
  }
};

export const getCustomersForSelect = async (req: Request, res: Response) => {
  try {
    const customers = await customerService.findCustomersForSelect((req.query.search as string) || "");
    return res.status(200).json(ResponseHelper.success(customers));
  } catch (err) {
    return handleError(res, err, "get customers for select");
  }
};

export const searchCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await customerService.searchCustomers((req.query.q as string) || "");
    return res.status(200).json(ResponseHelper.success(customers));
  } catch (err) {
    return handleError(res, err, "search customers");
  }
};
