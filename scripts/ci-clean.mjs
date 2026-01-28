import fs from "node:fs";

const isCI =
  !!process.env.CI ||
  !!process.env.RAILWAY_ENVIRONMENT ||
  !!process.env.RAILWAY_GIT_COMMIT_SHA;

if (isCI && fs.existsSync("node_modules")) {
  console.log("[ci-clean] removing node_modules for clean install...");
  fs.rmSync("node_modules", { recursive: true, force: true });
}
