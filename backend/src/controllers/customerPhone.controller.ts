import { Request, Response } from "express";
import { CustomerPhoneService } from "../services/customerPhone.service";
import { ApiResponse, ResponseHelper } from "../types/api";

// Initialize customer phone service
const customerPhoneService = new CustomerPhoneService();

/**
 * Get all phone numbers for a customer
 */
export const getCustomerPhones = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Customer ID is required",
          code: "MISSING_CUSTOMER_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    const phones = await customerPhoneService.getCustomerPhones(customerId);

    const response: ApiResponse = {
      success: true,
      data: phones,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching customer phones:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to fetch customer phone numbers",
        code: "CUSTOMER_PHONES_FETCH_ERROR",
      },
    };

    res.status(500).json(response);
  }
};

/**
 * Create a new phone number for a customer
 */
export const createCustomerPhone = async (req: Request, res: Response) => {
  try {
    const { customerId } = req.params;
    const { phoneNumber, isMain, label } = req.body;

    if (!customerId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Customer ID is required",
          code: "MISSING_CUSTOMER_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    if (!phoneNumber) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Phone number is required",
          code: "MISSING_PHONE_NUMBER",
        },
      };
      res.status(400).json(response);
      return;
    }

    const phone = await customerPhoneService.createCustomerPhone({
      customerId,
      phoneNumber,
      isMain,
      label,
    });

    const response: ApiResponse = {
      success: true,
      data: phone,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.status(201).json(response);
  } catch (error: any) {
    console.error("Error creating customer phone:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: error.message || "Failed to create customer phone number",
        code: "CUSTOMER_PHONE_CREATE_ERROR",
      },
    };

    res.status(400).json(response);
  }
};

/**
 * Update a customer phone number
 */
export const updateCustomerPhone = async (req: Request, res: Response) => {
  try {
    const { phoneId } = req.params;
    const { phoneNumber, isMain, label } = req.body;

    if (!phoneId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Phone ID is required",
          code: "MISSING_PHONE_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    const phone = await customerPhoneService.updateCustomerPhone(phoneId, {
      phoneNumber,
      isMain,
      label,
    });

    const response: ApiResponse = {
      success: true,
      data: phone,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error: any) {
    console.error("Error updating customer phone:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: error.message || "Failed to update customer phone number",
        code: "CUSTOMER_PHONE_UPDATE_ERROR",
      },
    };

    res.status(400).json(response);
  }
};

/**
 * Delete a customer phone number
 */
export const deleteCustomerPhone = async (req: Request, res: Response) => {
  try {
    const { phoneId } = req.params;

    if (!phoneId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Phone ID is required",
          code: "MISSING_PHONE_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    await customerPhoneService.deleteCustomerPhone(phoneId);

    const response: ApiResponse = {
      success: true,
      data: { message: "Phone number deleted successfully" },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error: any) {
    console.error("Error deleting customer phone:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: error.message || "Failed to delete customer phone number",
        code: "CUSTOMER_PHONE_DELETE_ERROR",
      },
    };

    res.status(400).json(response);
  }
};

/**
 * Set a phone number as main for a customer
 */
export const setMainPhone = async (req: Request, res: Response) => {
  try {
    const { phoneId } = req.params;

    if (!phoneId) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Phone ID is required",
          code: "MISSING_PHONE_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    const phone = await customerPhoneService.setMainPhone(phoneId);

    const response: ApiResponse = {
      success: true,
      data: phone,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error: any) {
    console.error("Error setting main phone:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: error.message || "Failed to set main phone number",
        code: "CUSTOMER_PHONE_SET_MAIN_ERROR",
      },
    };

    res.status(400).json(response);
  }
};