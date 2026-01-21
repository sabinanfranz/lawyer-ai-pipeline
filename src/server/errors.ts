import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "AGENT_FAILED"
  | "DB_ERROR"
  | "INTERNAL";

export function newRequestId() {
  return crypto.randomUUID();
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(args: {
  code: ApiErrorCode;
  message: string;
  status: number;
  requestId: string;
  details?: unknown;
}) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: args.code,
        message: args.message,
        details: args.details ?? null,
        requestId: args.requestId,
      },
    },
    { status: args.status }
  );
}

export function zodDetails(err: ZodError) {
  return err.flatten();
}

export async function readJson(req: Request): Promise<unknown | null> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
