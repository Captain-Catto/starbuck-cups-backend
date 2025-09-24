import { PrismaClient, ConsultationStatus } from "../generated/prisma";

export interface ConsultationCreateData {
  customer: {
    customerName: string;
    phoneNumber: string;
    address: string;
  };
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    color: string;
    capacity: string;
    category: string;
  }>;
  totalItems: number;
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
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async createConsultation(data: ConsultationCreateData) {
    try {
      // Validate that all product IDs exist
      const productIds = data.items.map((item) => item.productId);
      const existingProducts = await this.prisma.product.findMany({
        where: {
          id: {
            in: productIds,
          },
        },
        select: {
          id: true,
        },
      });

      const existingProductIds = existingProducts.map((p) => p.id);
      const missingProductIds = productIds.filter(
        (id) => !existingProductIds.includes(id)
      );

      if (missingProductIds.length > 0) {
        throw new Error(`Products not found: ${missingProductIds.join(", ")}`);
      }

      // Create consultation with items
      const consultation = await this.prisma.consultation.create({
        data: {
          customerName: data.customer.customerName,
          phoneNumber: data.customer.phoneNumber,
          address: data.customer.address,
          totalItems: data.totalItems,
          status: "PENDING",
          createdAt: new Date(data.createdAt),
          consultationItems: {
            create: data.items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              color: item.color,
              capacity: item.capacity,
              category: item.category,
            })),
          },
        },
        include: {
          consultationItems: true,
        },
      });

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
        where.createdAt = {};

        if (dateFrom) {
          // Parse dateFrom and set to start of day
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          where.createdAt.gte = fromDate;
        }

        if (dateTo) {
          // Parse dateTo and set to end of day
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          where.createdAt.lte = toDate;
        }
      }

      const [consultations, total] = await Promise.all([
        this.prisma.consultation.findMany({
          where,
          include: {
            consultationItems: {
              include: {
                product: {
                  include: {
                    productImages: {
                      orderBy: { order: "asc" },
                    },
                    productCategories: {
                      include: {
                        category: true,
                      },
                    },
                    productColors: {
                      include: {
                        color: true,
                      },
                    },
                    capacity: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        this.prisma.consultation.count({ where }),
      ]);

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
      const consultation = await this.prisma.consultation.findUnique({
        where: { id },
        include: {
          consultationItems: {
            include: {
              product: {
                include: {
                  productImages: {
                    orderBy: { order: "asc" },
                  },
                  productCategories: {
                    include: {
                      category: true,
                    },
                  },
                  productColors: {
                    include: {
                      color: true,
                    },
                  },
                  capacity: true,
                },
              },
            },
          },
        },
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
      const consultation = await this.prisma.consultation.update({
        where: { id },
        data: {
          status,
          notes,
          updatedAt: new Date(),
        },
        include: {
          consultationItems: {
            include: {
              product: {
                include: {
                  productImages: {
                    orderBy: { order: "asc" },
                  },
                  productCategories: {
                    include: {
                      category: true,
                    },
                  },
                  productColors: {
                    include: {
                      color: true,
                    },
                  },
                  capacity: true,
                },
              },
            },
          },
        },
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
      await this.prisma.consultationItem.deleteMany({
        where: { consultationId: id },
      });

      await this.prisma.consultation.delete({
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
      const count = await this.prisma.consultation.count({
        where: { status: "PENDING" },
      });

      return count;
    } catch (error) {
      console.error("Database error counting pending consultations:", error);
      throw new Error("Failed to count pending consultations from database");
    }
  }
}
