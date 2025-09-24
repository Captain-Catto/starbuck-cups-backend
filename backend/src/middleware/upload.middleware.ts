import multer from "multer";
import { Request, Response, NextFunction } from "express";

// Configure multer for memory storage (we'll upload to S3 directly)
const storage = multer.memoryStorage();

// File filter function
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  // Check file type
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Invalid file type. Only JPEG, PNG, GIF, WebP and SVG are allowed."
      )
    );
  }
};

// Multer configuration
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || "5242880"), // 5MB default
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
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case "LIMIT_FILE_SIZE":
        res.status(400).json({
          success: false,
          message: "File too large. Maximum size is 5MB.",
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

  if (error.message.includes("Invalid file type")) {
    res.status(400).json({
      success: false,
      message: error.message,
      error: "INVALID_FILE_TYPE",
    });
    return;
  }

  next(error);
};
