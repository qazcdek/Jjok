// 문서 계층 검사 (DevDocs/README.md §7). 실행: pnpm docs:check
// 1. 상위 문서: 모든 .md 는 상위 색인에 링크되어 있어야 한다 (고아 문서 금지).
//    - 일반 문서의 상위 = 같은 폴더의 README.md
//    - README.md 의 상위 = 가장 가까운 상위 폴더의 README.md (루트 README.md 가 꼭대기)
// 2. 깨진 링크: 상대 경로 링크의 대상 파일과 #절 앵커(GitHub 방식)가 있어야 한다.
// 3. 목록 버전: DevDocs/README.md 문서 목록의 버전이 각 문서 머리말 version 과 같아야 한다.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize, relative } from "node:path";

const ROOT = "README.md";
// 링크 대상이 아닌 생성물·외부 도구 문서
const IGNORE = [/^\.claude\//, /(^|\/)node_modules\//];

// -z: 한글 파일 이름을 따옴표·8진수로 바꾸지 않게 한다
const tracked = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard", "*.md"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter((f) => f && !IGNORE.some((re) => re.test(f)) && existsSync(f));

const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
// 코드 블록 안의 링크는 예시이므로 건너뛴다
const stripCode = (md) => md.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");

/** 문서 안의 상대 링크 → 저장소 기준 경로 (디렉터리 링크는 그 안의 README.md) */
function links(file) {
  const out = [];
  for (const [, raw] of stripCode(readFileSync(file, "utf8")).matchAll(LINK)) {
    if (/^[a-z]+:/i.test(raw) || raw.startsWith("#")) continue; // 외부 주소, 같은 문서 안
    const path = decodeURIComponent(raw.split("#")[0]);
    let target = normalize(join(dirname(file), path));
    if (existsSync(target) && statSync(target).isDirectory()) target = join(target, "README.md");
    out.push({
      raw,
      target,
      anchor: raw.includes("#") ? decodeURIComponent(raw.split("#")[1]) : undefined,
    });
  }
  return out;
}

/** GitHub 제목 앵커: 소문자, 글자·숫자·공백·-·_ 외 제거, 공백 → -. 같은 제목은 -1, -2 */
function anchors(file) {
  const seen = new Map();
  const out = new Set();
  const md = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const [, title] of md.matchAll(/^#{1,6} +(.+?) *$/gm)) {
    const base = title
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M} _-]/gu, "")
      .replace(/ /g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n === 0 ? base : `${base}-${n}`);
  }
  return out;
}

const errors = [];
const reached = new Set([ROOT]);
const queue = [ROOT];
while (queue.length > 0) {
  const file = queue.shift();
  for (const { raw, target, anchor } of links(file)) {
    if (!existsSync(target)) {
      errors.push(`깨진 링크: ${file} → ${raw}`);
      continue;
    }
    if (anchor && target.endsWith(".md") && !anchors(target).has(anchor)) {
      errors.push(`없는 절 앵커: ${file} → ${raw}`);
    }
    if (target.endsWith(".md") && !reached.has(target)) {
      reached.add(target);
      queue.push(target);
    }
  }
}
/** 상위 색인: 같은 폴더 README.md, README.md 자신이면 가장 가까운 상위 폴더의 README.md */
function parentIndex(file) {
  let dir = dirname(file);
  if (file.endsWith("README.md")) {
    if (file === ROOT) return undefined;
    dir = dirname(dir);
  }
  for (;;) {
    const candidate = normalize(join(dir, "README.md"));
    if (candidate !== file && existsSync(candidate)) return candidate;
    if (dir === "." || dir === "") return ROOT;
    dir = dirname(dir);
  }
}

for (const f of tracked) {
  const parent = parentIndex(f);
  if (!parent) continue;
  const linked = existsSync(parent) && links(parent).some(({ target }) => target === f);
  if (!linked) errors.push(`상위 색인에 없음: ${f} (${parent} 에 링크 추가)`);
  else if (!reached.has(f)) errors.push(`루트에서 닿지 않음: ${f}`);
}
// 루트에서 닿지 않는 문서의 링크도 깨진 것은 알린다
for (const f of tracked.filter((f) => !reached.has(f))) {
  for (const { raw, target } of links(f)) {
    if (!existsSync(target)) errors.push(`깨진 링크: ${f} → ${raw}`);
  }
}

// DevDocs 목록 버전 = 머리말 버전
const index = readFileSync("DevDocs/README.md", "utf8");
for (const [, id, link, version] of index.matchAll(
  /^\| (DEV-\d+) \| \[[^\]]+\]\(([^)]+)\) \| [^|]+ \| ([\d.]+) \|/gm,
)) {
  const doc = join("DevDocs", link);
  const front = existsSync(doc) && readFileSync(doc, "utf8").match(/^version: (\S+)$/m)?.[1];
  if (front !== version) {
    errors.push(
      `DevDocs/README.md 목록 버전 불일치: ${id} 목록 ${version}, 문서 ${front ?? "없음"}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  console.error(`\n문서 검사 실패 ${errors.length}건. 규칙: DevDocs/README.md §7`);
  process.exit(1);
}
console.log(`문서 검사 통과: ${tracked.length}개 문서, 모두 상위 색인에 연결됨, 깨진 링크 없음`);
