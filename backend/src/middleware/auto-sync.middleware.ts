/**
 * Middleware helper để sync data với MeiliSearch sau khi CRUD operations
 */
import { Request, Response, NextFunction } from "express";
import { MeiliSearchSyncMiddleware } from "./meilisearch-sync.middleware";

interface SyncOptions {
  entity: "product" | "category" | "color" | "capacity" | "customer";
  operation: "create" | "update" | "delete";
  getDataFn?: (req: Request, res: Response) => any;
}

/**
 * Middleware để sync data với MeiliSearch sau khi response đã được gửi
 */
export function syncAfterResponse(options: SyncOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json;

    // Override json method to sync data after response
    res.json = function (body: any) {
      // Send response first
      const result = originalJson.call(this, body);

      // Sync to MeiliSearch after response is sent (non-blocking)
      if (body.success) {
        setImmediate(() => {
          syncData(options, req, res, body);
        });
      }

      return result;
    };

    next();
  };
}

async function syncData(
  options: SyncOptions,
  req: Request,
  res: Response,
  responseBody: any
) {
  try {
    const { entity, operation } = options;

    switch (entity) {
      case "product":
        await handleProductSync(operation, req, responseBody);
        break;
      case "category":
        await handleCategorySync(operation, req, responseBody);
        break;
      case "color":
        await handleColorSync(operation, req, responseBody);
        break;
      case "capacity":
        await handleCapacitySync(operation, req, responseBody);
        break;
      case "customer":
        await handleCustomerSync(operation, req, responseBody);
        break;
    }
  } catch (error) {
    console.error("🔍 MeiliSearch sync error:", error);
    // Don't throw - sync errors shouldn't affect the main response
  }
}

async function handleProductSync(
  operation: string,
  req: Request,
  responseBody: any
) {
  if (operation === "delete") {
    const productId = req.params.id;
    await MeiliSearchSyncMiddleware.deleteProduct(productId);
  } else if (operation === "create" || operation === "update") {
    const productData = responseBody.data;
    if (productData) {
      await MeiliSearchSyncMiddleware.syncProduct(productData);
    }
  }
}

async function handleCategorySync(
  operation: string,
  req: Request,
  responseBody: any
) {
  if (operation === "delete") {
    const categoryId = req.params.id;
    await MeiliSearchSyncMiddleware.deleteCategory(categoryId);
  } else if (operation === "create" || operation === "update") {
    const categoryData = responseBody.data;
    if (categoryData) {
      await MeiliSearchSyncMiddleware.syncCategory(categoryData);
    }
  }
}

async function handleColorSync(
  operation: string,
  req: Request,
  responseBody: any
) {
  if (operation === "delete") {
    const colorId = req.params.id;
    await MeiliSearchSyncMiddleware.deleteColor(colorId);
  } else if (operation === "create" || operation === "update") {
    const colorData = responseBody.data;
    if (colorData) {
      await MeiliSearchSyncMiddleware.syncColor(colorData);
    }
  }
}

async function handleCapacitySync(
  operation: string,
  req: Request,
  responseBody: any
) {
  if (operation === "delete") {
    const capacityId = req.params.id;
    await MeiliSearchSyncMiddleware.deleteCapacity(capacityId);
  } else if (operation === "create" || operation === "update") {
    const capacityData = responseBody.data;
    if (capacityData) {
      await MeiliSearchSyncMiddleware.syncCapacity(capacityData);
    }
  }
}

async function handleCustomerSync(
  operation: string,
  req: Request,
  responseBody: any
) {
  if (operation === "delete") {
    const customerId = req.params.id;
    await MeiliSearchSyncMiddleware.deleteCustomer(customerId);
  } else if (operation === "create" || operation === "update") {
    const customerData = responseBody.data;
    if (customerData) {
      await MeiliSearchSyncMiddleware.syncCustomer(customerData);
    }
  }
}

/**
 * Convenience functions for common operations
 */
export const syncProduct = {
  create: () => syncAfterResponse({ entity: "product", operation: "create" }),
  update: () => syncAfterResponse({ entity: "product", operation: "update" }),
  delete: () => syncAfterResponse({ entity: "product", operation: "delete" }),
};

export const syncCategory = {
  create: () => syncAfterResponse({ entity: "category", operation: "create" }),
  update: () => syncAfterResponse({ entity: "category", operation: "update" }),
  delete: () => syncAfterResponse({ entity: "category", operation: "delete" }),
};

export const syncColor = {
  create: () => syncAfterResponse({ entity: "color", operation: "create" }),
  update: () => syncAfterResponse({ entity: "color", operation: "update" }),
  delete: () => syncAfterResponse({ entity: "color", operation: "delete" }),
};

export const syncCapacity = {
  create: () => syncAfterResponse({ entity: "capacity", operation: "create" }),
  update: () => syncAfterResponse({ entity: "capacity", operation: "update" }),
  delete: () => syncAfterResponse({ entity: "capacity", operation: "delete" }),
};

export const syncCustomer = {
  create: () => syncAfterResponse({ entity: "customer", operation: "create" }),
  update: () => syncAfterResponse({ entity: "customer", operation: "update" }),
  delete: () => syncAfterResponse({ entity: "customer", operation: "delete" }),
};
