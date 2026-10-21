// 업로드 전 중복 검사 (M1-T2, F-2.3): Firestore·드라이브를 가짜로 바꿔 흐름만 확인한다
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existing: [] as { id: string; data: Record<string, unknown> }[],
  batchSets: [] as Record<string, unknown>[],
  queries: [] as unknown[],
}));

vi.mock("../../lib/firebase/app", () => ({ db: {} }));
vi.mock("../../lib/firebase/users", () => ({
  loadDriveFolders: async () => ({ rootFolderId: "r", filesFolderId: "f" }),
  saveDriveFolders: async () => {},
}));
const uploadMock = vi.hoisted(() => vi.fn(async () => ({ fileId: "drive-file-1" })));
vi.mock("../../lib/drive", () => ({
  drive: {
    ensureAppFolders: async () => ({ rootFolderId: "r", filesFolderId: "f" }),
    uploadPdf: uploadMock,
  },
}));
vi.mock("firebase/firestore", () => {
  let n = 0;
  return {
    collection: (...path: unknown[]) => ({ path: path.slice(1).join("/") }),
    doc: (col: { path: string }, id?: string) => ({ id: id ?? `auto${++n}`, path: col.path }),
    where: (...args: unknown[]) => ({ where: args }),
    limit: (k: number) => ({ limit: k }),
    query: (...args: unknown[]) => {
      state.queries.push(args);
      return args;
    },
    getDocs: async () => ({
      docs: state.existing.map((e) => ({ id: e.id, data: () => e.data })),
    }),
    serverTimestamp: () => "ts",
    writeBatch: () => ({
      set: (_ref: unknown, data: Record<string, unknown>) => state.batchSets.push(data),
      commit: async () => {},
    }),
  };
});

const { uploadPdf } = await import("./uploads");

const pdf = (name: string, body = "%PDF-1.4 a") =>
  new File([body], name, { type: "application/pdf" });

beforeEach(() => {
  state.existing = [];
  state.batchSets = [];
  state.queries = [];
  uploadMock.mockClear();
});

describe("uploadPdf 중복 검사", () => {
  it("같은 해시의 논문이 있으면 드라이브에 올리지 않고 duplicate 를 돌려준다", async () => {
    state.existing = [{ id: "w9", data: { title: "Attention Is All You Need" } }];
    const result = await uploadPdf("alice", pdf("again.pdf"));
    expect(result).toMatchObject({
      kind: "duplicate",
      workId: "w9",
      title: "Attention Is All You Need",
    });
    expect(uploadMock).not.toHaveBeenCalled();
    expect(state.batchSets).toHaveLength(0);
    expect(JSON.stringify(state.queries[0])).toContain("fileHashes");
    expect(JSON.stringify(state.queries[0])).toContain("array-contains");
  });

  it("새 파일이면 올리고, 논문 문서의 fileHashes 에 해시를 넣는다", async () => {
    const result = await uploadPdf("alice", pdf("new.pdf"));
    expect(result.kind).toBe("uploaded");
    expect(uploadMock).toHaveBeenCalledOnce();
    const work = state.batchSets.find((d) => "primaryVersionId" in d)!;
    const version = state.batchSets.find((d) => "driveFileId" in d)!;
    expect(work.fileHashes).toEqual([version.fileHash]);
    expect(work.title).toBe("new");
  });
});
