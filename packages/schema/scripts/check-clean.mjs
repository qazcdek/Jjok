// 생성물이 커밋된 것과 같은지 확인한다 (새로 생긴 파일도 잡도록 git status 사용)
import { execFileSync } from "node:child_process";

const paths = ["apps/web/src/lib/schema", "services/agent/src/agent/schema"];
const out = execFileSync("git", ["status", "--porcelain", "--", ...paths], {
  cwd: new URL("../../..", import.meta.url),
  encoding: "utf8",
});
if (out.trim()) {
  console.error("생성물이 최신이 아닙니다. `pnpm schema:gen` 후 커밋하세요:\n" + out);
  process.exit(1);
}
console.log("스키마 생성물 최신");
