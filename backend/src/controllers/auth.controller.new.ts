import { Request, Response } from "express";
import { ResponseHelper } from "../types/api";

/**
 * Session check - return user info nếu đã auth bởi middleware
 */
export const sessionCheck = (req: Request, res: Response) => {
  // Middleware đã set req.user nếu auth thành công
  if (!req.user) {
    return res.status(401).json(
      ResponseHelper.error("No valid session", "NO_SESSION")
    );
  }

  return res.status(200).json(
    ResponseHelper.success({
      user: {
        id: req.user.userId,
        email: req.user.email,
        name: req.user.username,
        role: req.user.role,
      },
      message: "Session valid",
    })
  );
};