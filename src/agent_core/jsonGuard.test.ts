import crypto from "node:crypto";
import { z } from "zod";
import { jsonGuard } from "@/agent_core/jsonGuard";

vi.stubGlobal("crypto", crypto as unknown as Crypto);

test("jsonGuard falls back when parse/repair fails", async () => {
  const schema = z.object({ a: z.number() });

  const out = await jsonGuard({
    raw: "NOT JSON",
    schema,
    repair: async () => "STILL NOT JSON",
    fallback: () => ({ a: 1 }),
    maxRepairAttempts: 2,
  });

  expect(out.used_fallback).toBe(true);
  expect(out.data).toEqual({ a: 1 });
});
