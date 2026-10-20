// JSON Schema → TS 타입 / Pydantic 모델 생성. DevDocs/07-dev-environment.md §5
// 생성물은 직접 수정하지 않는다.
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compileFromFile } from "json-schema-to-typescript";

const here = dirname(fileURLToPath(import.meta.url));
const schemaDir = resolve(here, "../schemas");
const root = resolve(here, "../../..");
const tsOut = join(root, "apps/web/src/lib/schema");
const pyOut = join(root, "services/api/src/jjok/schema");
const DATAMODEL_CODEGEN = "datamodel-code-generator[ruff]==0.86.0";

const BANNER =
  "/* 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen */";

// common.schema.json 은 $defs 만 가진 정의 파일이므로 TS 파일을 따로 만들지 않는다
const entities = readdirSync(schemaDir).filter(
  (f) => f.endsWith(".schema.json") && f !== "common.schema.json",
);

rmSync(tsOut, { recursive: true, force: true });
mkdirSync(tsOut, { recursive: true });
const exports = [];
// 공통 정의(ExternalIds 등)는 참조한 파일마다 다시 생성된다. index 에서는 처음 나온 것만 내보낸다
const exported = new Set();
for (const file of entities) {
  const name = file.replace(".schema.json", "");
  let ts = await compileFromFile(join(schemaDir, file), {
    cwd: schemaDir,
    bannerComment: BANNER,
    additionalProperties: false,
    style: { singleQuote: false, printWidth: 100 },
  });
  if (ts.includes("Timestamp")) {
    ts = ts.replace(BANNER, `${BANNER}\nimport type { Timestamp } from "firebase/firestore";`);
  }
  writeFileSync(join(tsOut, `${name}.ts`), ts);
  const names = [...ts.matchAll(/^export (?:interface|type) (\w+)/gm)]
    .map((m) => m[1])
    .filter((n) => !exported.has(n));
  names.forEach((n) => exported.add(n));
  if (names.length > 0) exports.push(`export type { ${names.join(", ")} } from "./${name}";`);
}
writeFileSync(join(tsOut, "index.ts"), `${BANNER}\n${exports.join("\n")}\n`);

// 저장소 안의 ruff 설정이 생성기 포매팅에 섞이지 않도록 임시 폴더에 만든 뒤 옮긴다
const pyTmp = join(mkdtempSync(join(tmpdir(), "jjok-schema-")), "schema");
execFileSync(
  "uvx",
  [
    "--python",
    "3.12",
    "--from",
    DATAMODEL_CODEGEN,
    "datamodel-codegen",
    "--input",
    schemaDir,
    "--input-file-type",
    "jsonschema",
    "--output",
    pyTmp,
    "--output-model-type",
    "pydantic_v2.BaseModel",
    "--target-python-version",
    "3.12",
    "--use-standard-collections",
    "--use-union-operator",
    "--use-schema-description",
    "--disable-timestamp",
    "--enum-field-as-literal",
    "all",
    "--formatters",
    "ruff-check",
    "ruff-format",
    "--custom-file-header",
    "# 자동 생성 파일 — 수정 금지. 원본: packages/schema/schemas, 생성: pnpm schema:gen",
  ],
  { stdio: "inherit" },
);
rmSync(pyOut, { recursive: true, force: true });
cpSync(pyTmp, pyOut, { recursive: true });
rmSync(dirname(pyTmp), { recursive: true, force: true });

console.log(`생성 완료: ${entities.length}개 엔티티 → ${tsOut}, ${pyOut}`);
