/**
 * Typed error thrown by service layer — controllers catch this to return
 * the correct HTTP status code without exposing internal logic.
 */
export class ServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "ServiceError";
  }
}
