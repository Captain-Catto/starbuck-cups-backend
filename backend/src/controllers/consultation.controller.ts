import { Request, Response } from "express";
import { models, ConsultationStatus } from "../models";
import { ConsultationService } from "../services/consultation.service";
import { ApiResponse, ResponseHelper } from "../types/api";
import { validateAndFormatPhone } from "../utils/phoneValidation";

import { socketService } from "../services/socket.service";

// Initialize consultation service
const consultationService = new ConsultationService();

/**
 * Create a new consultation
 */
export const createConsultation = async (req: Request, res: Response) => {
  try {
    const consultationData = req.body;

    // Validate request data
    if (!consultationData.customer) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Customer information is required",
          code: "MISSING_CUSTOMER_INFO",
        },
      };
      res.status(400).json(response);
      return;
    }

    // Validate phone number
    const phoneValidation = validateAndFormatPhone(consultationData.customer.phoneNumber);
    if (!phoneValidation.isValid) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: phoneValidation.error || "Invalid phone number",
          code: "INVALID_PHONE_NUMBER",
        },
      };
      res.status(400).json(response);
      return;
    }

    if (!consultationData.items || consultationData.items.length === 0) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Items are required for consultation",
          code: "MISSING_ITEMS",
        },
      };
      res.status(400).json(response);
      return;
    }

    const consultation =
      await consultationService.createConsultation(consultationData);

    // Emit Socket.IO notification for new consultation
    try {
      console.log(
        "📋 Consultation object structure:",
        JSON.stringify(consultation, null, 2)
      );
      socketService.emitConsultationCreated({
        id: consultation.id,
        customerName: consultation.customerName || "Unknown Customer",
        items: consultation.consultationItems?.length || 0,
      });
    } catch (socketError) {
      console.error("Error emitting consultation notification:", socketError);
      // Don't fail the request if socket emission fails
    }

    const response: ApiResponse = {
      success: true,
      data: consultation,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Error creating consultation:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to create consultation order",
        code: "CONSULTATION_CREATE_ERROR",
      },
    };

    res.status(500).json(response);
  }
};

/**
 * Get consultations with pagination and filters
 */
export const getConsultations = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10, status, dateFrom, dateTo } = req.query;

    const consultations = await consultationService.getConsultations({
      page: Number(page),
      limit: Number(limit),
      status: status as ConsultationStatus | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });

    return res
      .status(200)
      .json(
        ResponseHelper.paginated(consultations.data, consultations.pagination)
      );
  } catch (error) {
    console.error("Error fetching consultations:", error);
    return res
      .status(500)
      .json(
        ResponseHelper.error(
          "Failed to fetch consultations",
          "CONSULTATION_FETCH_ERROR"
        )
      );
  }
};

/**
 * Get consultation by ID
 */
export const getConsultationById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const consultation = await consultationService.getConsultationById(id);

    if (!consultation) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Consultation not found",
          code: "CONSULTATION_NOT_FOUND",
        },
      };
      res.status(404).json(response);
      return;
    }

    const response: ApiResponse = {
      success: true,
      data: consultation,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching consultation:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to fetch consultation",
        code: "CONSULTATION_FETCH_ERROR",
      },
    };

    res.status(500).json(response);
  }
};

/**
 * Update consultation status
 */
export const updateConsultationStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const consultation = await consultationService.updateConsultationStatus(
      id,
      status,
      notes
    );

    const response: ApiResponse = {
      success: true,
      data: consultation,
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error updating consultation:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to update consultation",
        code: "CONSULTATION_UPDATE_ERROR",
      },
    };

    res.status(500).json(response);
  }
};

/**
 * Delete consultation
 */
export const deleteConsultation = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      const response: ApiResponse = {
        success: false,
        data: null,
        meta: { timestamp: new Date().toISOString() },
        error: {
          message: "Consultation ID is required",
          code: "MISSING_ID",
        },
      };
      res.status(400).json(response);
      return;
    }

    await consultationService.deleteConsultation(id);

    const response: ApiResponse = {
      success: true,
      data: { message: "Consultation deleted successfully" },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error deleting consultation:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to delete consultation",
        code: "CONSULTATION_DELETE_ERROR",
      },
    };

    res.status(500).json(response);
  }
};

/**
 * Get pending consultations count
 */
export const getPendingConsultationsCount = async (
  req: Request,
  res: Response
) => {
  try {
    const count = await consultationService.getPendingConsultationsCount();

    const response: ApiResponse = {
      success: true,
      data: { count },
      meta: { timestamp: new Date().toISOString() },
      error: null,
    };

    res.json(response);
  } catch (error) {
    console.error("Error fetching pending consultations count:", error);

    const response: ApiResponse = {
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: {
        message: "Failed to fetch pending consultations count",
        code: "CONSULTATION_COUNT_ERROR",
      },
    };

    res.status(500).json(response);
  }
};
