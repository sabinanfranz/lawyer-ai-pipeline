import { env } from "@/server/env";
import { InMemoryContentRepo } from "./inMemoryContentRepo";
import { PrismaContentRepo } from "./prismaContentRepo";
import type { ContentRepo } from "./contentRepo";

export function getContentRepo(): ContentRepo {
  // DATABASE_URL이 있으면 DB 모드, 없으면 메모리 모드
  if (env.DATABASE_URL) return new PrismaContentRepo();
  return new InMemoryContentRepo();
}
