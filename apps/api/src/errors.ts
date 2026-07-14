import type { FastifyReply } from "fastify";

export type ApiErrorCode =
  | "INVALID_REQUEST"
  | "AUTHENTICATION_REQUIRED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "WORKFORCE_CONFLICT"
  | "HOMELAND_CONFLICT"
  | "WORLD_CAPACITY_REACHED"
  | "DATABASE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly issues?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  issues?: unknown
) {
  return reply.code(statusCode).send({
    error: {
      code,
      message,
      ...(issues === undefined ? {} : { issues }),
      requestId: reply.request.id
    }
  });
}

export const notFound = (message: string) => new ApiError(404, "NOT_FOUND", message);
export const forbidden = (message = "You do not own this resource") => new ApiError(403, "FORBIDDEN", message);
export const conflict = (message: string) => new ApiError(409, "CONFLICT", message);
