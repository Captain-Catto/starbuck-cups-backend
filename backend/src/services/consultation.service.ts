import { Consultation, ConsultationStatus } from "../models/Consultation";
import { ConsultationItem } from "../models/ConsultationItem";
import { Product } from "../models/Product";
import { ProductImage } from "../models/ProductImage";
import { sequelize } from "../config/database";
import { Op } from "sequelize";

export interface ConsultationCreateData {
  customer: {
    customerName: string;
    phoneNumber: string;
    email?: string;
    address: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    color: string;
    capacity: string;
    category: string;
  }>;
  createdAt: string;
}

export interface ConsultationFilters {
  page: number;
  limit: number;
  status?: ConsultationStatus;
  dateFrom?: string;
  dateTo?: string;
}

export class ConsultationService {
  constructor() {}

  async createConsultation(data: ConsultationCreateData) {
    try {

      // Validate that all product IDs exist
      const productIds = data.items.map((item) => item.productId);
      const existingProducts = await Product.findAll({
        where: {
          id: {
            [Op.in]: productIds,
          },
        },
        attributes: ["id"],
      });

      const existingProductIds = existingProducts.map((p) => p.id);
      const missingProductIds = productIds.filter(
        (id) => !existingProductIds.includes(id)
      );

      if (missingProductIds.length > 0) {
        throw new Error(`Products not found: ${missingProductIds.join(", ")}`);
      }

      // Create consultation
      const consultation = await Consultation.create({
        customerName: data.customer.customerName,
        phoneNumber: data.customer.phoneNumber,
        email: data.customer.email,
        address: data.customer.address,
        status: ConsultationStatus.PENDING,
      });

      // Create consultation items
      const consultationItems = await Promise.all(
        data.items.map((item) =>
          ConsultationItem.create({
            consultationId: consultation.id,
            productId: item.productId,
            productName: item.productName,
            color: item.color,
            capacity: item.capacity,
            category: item.category,
          })
        )
      );

      // Return consultation with items
      const consultationWithItems = await Consultation.findByPk(
        consultation.id,
        {
          include: [
            {
              model: ConsultationItem,
              as: "consultationItems",
            },
          ],
        }
      );

      return consultation;
    } catch (error) {
      console.error("Database error creating consultation:", error);
      throw new Error("Failed to create consultation in database");
    }
  }

  async getConsultations(filters: ConsultationFilters) {
    try {
      const { page, limit, status, dateFrom, dateTo } = filters;
      const skip = (page - 1) * limit;

      const where: any = {};

      if (status) {
        where.status = status;
      }

      // Date filtering
      if (dateFrom || dateTo) {
        const dateFilter: any = {};

        if (dateFrom) {
          // Parse dateFrom and set to start of day
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          dateFilter[Op.gte] = fromDate;
        }

        if (dateTo) {
          // Parse dateTo and set to end of day
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          dateFilter[Op.lte] = toDate;
        }

        where.createdAt = dateFilter;
      }

      const result = await Consultation.findAndCountAll({
        where,
        include: [
          {
            model: ConsultationItem,
            as: "consultationItems",
            include: [
              {
                model: Product,
                as: "product",
                include: [
                  {
                    model: ProductImage,
                    as: "productImages",
                  },
                ],
              },
            ],
          },
        ],
        order: [["createdAt", "DESC"]],
        offset: skip,
        limit: limit,
      });

      const consultations = result.rows;
      const total = result.count;

      const totalPages = Math.ceil(total / limit);

      return {
        data: consultations,
        pagination: {
          current_page: page,
          per_page: limit,
          total_pages: totalPages,
          total_items: total,
          has_next: page < totalPages,
          has_prev: page > 1,
        },
      };
    } catch (error) {
      console.error("Database error fetching consultations:", error);
      throw new Error("Failed to fetch consultations from database");
    }
  }

  async getConsultationById(id: string) {
    try {
      const consultation = await Consultation.findByPk(id, {
        include: [
          {
            model: ConsultationItem,
            as: "consultationItems",
            include: [
              {
                model: Product,
                as: "product",
                // Note: Full product relations will need to be defined in Product model
              },
            ],
          },
        ],
      });

      return consultation;
    } catch (error) {
      console.error("Database error fetching consultation:", error);
      throw new Error("Failed to fetch consultation from database");
    }
  }

  async updateConsultationStatus(
    id: string,
    status: ConsultationStatus,
    notes?: string
  ) {
    try {
      await Consultation.update(
        {
          status,
          notes,
          updatedAt: new Date(),
        },
        {
          where: { id },
        }
      );

      // Return updated consultation with relations
      const consultation = await Consultation.findByPk(id, {
        include: [
          {
            model: ConsultationItem,
            as: "consultationItems",
            include: [
              {
                model: Product,
                as: "product",
                // Note: Full product relations will need to be defined in Product model
              },
            ],
          },
        ],
      });

      return consultation;
    } catch (error) {
      console.error("Database error updating consultation:", error);
      throw new Error("Failed to update consultation in database");
    }
  }

  async deleteConsultation(id: string) {
    try {
      // Delete consultation items first, then consultation
      await ConsultationItem.destroy({
        where: { consultationId: id },
      });

      await Consultation.destroy({
        where: { id },
      });

      return { success: true };
    } catch (error) {
      console.error("Database error deleting consultation:", error);
      throw new Error("Failed to delete consultation from database");
    }
  }

  async getPendingConsultationsCount() {
    try {
      const count = await Consultation.count({
        where: { status: ConsultationStatus.PENDING },
      });

      return count;
    } catch (error) {
      console.error("Database error counting pending consultations:", error);
      throw new Error("Failed to count pending consultations from database");
    }
  }
}
