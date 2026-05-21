import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  data: T,
  status = 200,
  message?: string
) {
  return res.status(status).json({
    success: true,
    message,
    data,
  });
}

export function sendError(
  res: Response,
  message: string,
  status = 400,
  errors?: unknown
) {
  return res.status(status).json({
    success: false,
    message,
    errors,
  });
}
