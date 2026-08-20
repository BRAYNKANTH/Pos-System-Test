import { NextResponse } from "next/server";
export { errorMessage } from "./errors";

// Shared API response envelope — every route handler in every module
// should return one of these two shapes. See docs/api-contracts.md for the
// full spec (this file is the implementation of that contract).

export type ApiSuccess<T> = {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: Record<string, unknown>;
};

export type ApiResponseBody<T> = ApiSuccess<T> | ApiError;

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; meta?: Record<string, unknown> },
) {
  const body: ApiSuccess<T> = { success: true, data, meta: init?.meta };
  return NextResponse.json(body, { status: init?.status ?? 200 });
}

export function apiError(
  code: string,
  message: string,
  init?: { status?: number; details?: unknown; meta?: Record<string, unknown> },
) {
  const body: ApiError = {
    success: false,
    error: { code, message, details: init?.details },
    meta: init?.meta,
  };
  return NextResponse.json(body, { status: init?.status ?? 400 });
}
