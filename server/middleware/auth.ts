import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { User, type IUser } from "../models/User";
import { sendError } from "../utils/response";

export interface AuthRequest extends Request {
  user?: IUser;
}

interface JwtPayload {
  userId: string;
}

export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return sendError(res, "Unauthorized", 401);
    }

    const token = header.slice(7);
    const decoded = jwt.verify(token, env.jwtSecret) as JwtPayload;
    const user = await User.findById(decoded.userId).select("+password");

    if (!user) {
      return sendError(res, "User not found", 401);
    }

    req.user = user;
    next();
  } catch {
    return sendError(res, "Invalid or expired token", 401);
  }
}

export function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (
    !req.user ||
    !["superadmin", "admin", "seller"].includes(req.user.role)
  ) {
    return sendError(res, "Seller access required", 403);
  }
  next();
}

export function requireSuperAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user || req.user.role !== "superadmin") {
    return sendError(res, "Superadmin access required", 403);
  }
  next();
}

export function serializeUser(user: IUser) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    address: user.address,
    sellerId: user.sellerId,
    createdAt: user.createdAt,
  };
}
