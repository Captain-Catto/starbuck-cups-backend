import multer from "multer";
import { Request, Response, NextFunction } from "express";

// Configure multer for memory storage before image processing and external upload.
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check file type. This only filters on the client-supplied Content-Type,
  // which is trivially spoofable — the real validation is that every
  // uploaded file is re-encoded through sharp (see image-processing.service)
  // before it's ever persisted or served, so this filter is a first-pass
  // reject, not the security boundary.
  //
  // SVG is deliberately excluded: it's XML, not a raster format, and its
  // only use as an XSS vector (embedded <script>/event handlers surviving
  // to be served) matters even though sharp re-rasterizes uploads, because
  // it also expands the attack surface to librsvg's XML/SVG parser for a
  // format this product-photo catalog never actually needs.
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
    "image/heic-sequence",
    "image/heif-sequence",
  ];

  // Some mobile browsers send HEIC with an empty or generic Content-Type,
  // so fall back to the file extension in that case. The real format is
  // verified by magic bytes + sharp re-encoding in image-processing.service.
  const isGenericMime = !file.mimetype || file.mimetype === "application/octet-stream";
  const hasHeicExtension = /\.(heic|heif)$/i.test(file.originalname);

  if (allowedMimes.includes(file.mimetype) || (isGenericMime && hasHeicExtension)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP, AVIF, and HEIC are allowed."
      )
    );
  }
};

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB default, per file
    files: 10, // Maximum 10 files per request
  },
});

// Middleware for single file upload
export const uploadSingle = (fieldName: string = "image") =>
  upload.single(fieldName);

// Middleware for multiple file upload
export const uploadMultiple = (
  fieldName: string = "images",
  maxCount: number = 10
) => upload.array(fieldName, maxCount);

// Middleware for multiple fields with files
export const uploadFields = (
  fields: Array<{ name: string; maxCount?: number }>
) => upload.fields(fields);

// Error handler for multer errors
export const handleMulterError = (
  error: Error & { code?: string; field?: string },
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        res.status(400).json({
          success: false,
          message: "One of the selected images is too large. Maximum size is 10MB per image.",
          error: "FILE_TOO_LARGE",
        });
        return;
      case "LIMIT_FILE_COUNT":
        res.status(400).json({
          success: false,
          message: "Too many files. Maximum is 10 files.",
          error: "TOO_MANY_FILES",
        });
        return;
      case "LIMIT_UNEXPECTED_FILE":
        res.status(400).json({
          success: false,
          message: "Unexpected field name for file upload.",
          error: "UNEXPECTED_FIELD",
        });
        return;
      default:
        res.status(400).json({
          success: false,
          message: "File upload error.",
          error: error.code,
        });
        return;
    }
  }

  if (error && error.message && error.message.includes("Invalid file type")) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: "INVALID_FILE_TYPE",
    });
    return;
  }

  next(error);
};
