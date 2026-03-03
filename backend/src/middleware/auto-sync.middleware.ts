/**
 * Middleware helper để sync data với MeiliSearch sau khi CRUD operations
 */
import { Request, Response, NextFunction } from "express";
import { MeiliSearchSyncMiddleware } from "./meilisearch-sync.middleware";

interface SyncOptions {
  entity: "product" | "category" | "color" | "capacity" | "customer";
  operation: "create" | "update" | "delete";
}

const isSuccessfulResponse = (res: Response, body: any): boolean => {
  return (
    body?.success === true &&
    res.statusCode >= 200 &&
    res.statusCode < 300
  );
};

const resolveEntityId = (
  entity: SyncOptions["entity"],
  req: Request,
  body: any
): string | null => {
  if (req.params.id) {
    return String(req.params.id);
  }

  if (entity === "customer" && typeof req.params.customerId === "string") {
    return req.params.customerId;
  }

  const data = body?.data;
  if (!data) {
    return null;
  }

  if (entity === "customer" && typeof data.customerId === "string") {
    return data.customerId;
  }

  if (typeof data.id === "string") {
    return data.id;
  }

  if (entity === "product" && typeof data.product?.id === "string") {
    return data.product.id;
  }

  return null;
};

/**
 * Middleware để sync data với MeiliSearch sau khi response đã được gửi
 */
export function syncAfterResponse(options: SyncOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      const result = originalJson(body);

      if (isSuccessfulResponse(res, body)) {
        setImmediate(() => {
          void syncData(options, req, body);
        });
      }

      return result;
    } as Response["json"];

    next();
  };
}

async function syncData(options: SyncOptions, req: Request, responseBody: any) {
  try {
    const entityId = resolveEntityId(options.entity, req, responseBody);
    if (!entityId) {
      console.warn(
        `⚠️ MeiliSearch sync skipped: missing id for ${options.entity}:${options.operation}`
      );
      return;
    }

    switch (options.entity) {
      case "product":
        if (options.operation === "delete") {
          await MeiliSearchSyncMiddleware.deleteProduct(entityId);
        } else {
          await MeiliSearchSyncMiddleware.syncProductById(entityId);
        }
        break;
      case "category":
        if (options.operation === "delete") {
          await MeiliSearchSyncMiddleware.deleteCategory(entityId);
        } else {
          await MeiliSearchSyncMiddleware.syncCategoryById(entityId);
        }
        break;
      case "color":
        if (options.operation === "delete") {
          await MeiliSearchSyncMiddleware.deleteColor(entityId);
        } else {
          await MeiliSearchSyncMiddleware.syncColorById(entityId);
        }
        break;
      case "capacity":
        if (options.operation === "delete") {
          await MeiliSearchSyncMiddleware.deleteCapacity(entityId);
        } else {
          await MeiliSearchSyncMiddleware.syncCapacityById(entityId);
        }
        break;
      case "customer":
        if (options.operation === "delete") {
          await MeiliSearchSyncMiddleware.deleteCustomer(entityId);
        } else {
          await MeiliSearchSyncMiddleware.syncCustomerById(entityId);
        }
        break;
    }
  } catch (error) {
    console.error("🔍 MeiliSearch sync error:", error);
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
