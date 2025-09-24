/**
 * Standardized API Response Types
 * Used across all endpoints for consistent response format
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  meta: Record<string, any>;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code: string;
  details?: any;
  stack?: string;
}

export interface PaginationMeta {
  current_page: number;
  per_page: number;
  total_pages: number;
  total_items: number;
  has_next: boolean;
  has_prev: boolean;
}

export interface ListResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

// Helper functions for creating standardized responses
export class ResponseHelper {
  static success<T>(data: T, meta: Record<string, any> = {}): ApiResponse<T> {
    return {
      success: true,
      data,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
      error: null,
    };
  }

  static error(
    message: string,
    code: string = "UNKNOWN_ERROR",
    details?: any,
    meta: Record<string, any> = {}
  ): ApiResponse<null> {
    return {
      success: false,
      data: null,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta,
      },
      error: {
        message,
        code,
        details,
      },
    };
  }

  static paginated<T>(
    items: T[],
    pagination: PaginationMeta,
    meta: Record<string, any> = {}
  ): ApiResponse<ListResponse<T>> {
    return this.success(
      {
        items,
        pagination,
      },
      meta
    );
  }
}

// Common error codes
export const ErrorCodes = {
  // Authentication & Authorization
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",

  // Validation
  VALIDATION_ERROR: "VALIDATION_ERROR",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",

  // Resources
  NOT_FOUND: "NOT_FOUND",
  ALREADY_EXISTS: "ALREADY_EXISTS",
  CONFLICT: "CONFLICT",

  // Business Logic
  INSUFFICIENT_STOCK: "INSUFFICIENT_STOCK",
  CANNOT_DELETE_IN_USE: "CANNOT_DELETE_IN_USE",
  INVALID_STATUS_TRANSITION: "INVALID_STATUS_TRANSITION",

  // System
  INTERNAL_ERROR: "INTERNAL_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
} as const;
