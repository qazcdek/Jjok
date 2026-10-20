import { describe, expect, it } from "vitest";
import { defaultVersionLabel, mergeWorkIds, pickPrimaryVersion } from "./model";

describe("pickPrimaryVersion", () => {
  it("최종본에 가까운 종류를 고른다: journal > conference > workshop > preprint > other", () => {
    const picked = pickPrimaryVersion([
      { id: "a", kind: "preprint" },
      { id: "b", kind: "workshop" },
      { id: "c", kind: "conference" },
      { id: "d", kind: "other" },
    ]);
    expect(picked?.id).toBe("c");
  });

  it("같은 종류면 연도가 최신인 버전, 그다음 arXiv 버전이 높은 버전을 고른다", () => {
    expect(
      pickPrimaryVersion([
        { id: "a", kind: "conference", year: 2023 },
        { id: "b", kind: "conference", year: 2024 },
      ])?.id,
    ).toBe("b");
    expect(
      pickPrimaryVersion([
        { id: "v1", kind: "preprint", year: 2024, ids: { arxiv: "2401.1", arxivVersion: 1 } },
        { id: "v3", kind: "preprint", year: 2024, ids: { arxiv: "2401.1", arxivVersion: 3 } },
      ])?.id,
    ).toBe("v3");
  });

  it("모든 기준이 같으면 id 순으로 정해 결과가 항상 같다", () => {
    const vs = [
      { id: "z", kind: "other" as const },
      { id: "m", kind: "other" as const },
    ];
    expect(pickPrimaryVersion(vs)?.id).toBe("m");
    expect(pickPrimaryVersion([...vs].reverse())?.id).toBe("m");
  });

  it("빈 목록이면 undefined", () => {
    expect(pickPrimaryVersion([])).toBeUndefined();
  });
});

describe("mergeWorkIds", () => {
  it("버전의 식별자를 논문에 더하되 이미 있는 값은 덮어쓰지 않는다", () => {
    expect(
      mergeWorkIds(
        { arxiv: "1706.03762", s2: "abc" },
        { arxiv: "9999.99999", arxivVersion: 5, doi: "10.5555/x" },
      ),
    ).toEqual({ arxiv: "1706.03762", s2: "abc", doi: "10.5555/x" });
  });

  it("버전에만 있는 arxivVersion 은 논문으로 옮기지 않는다", () => {
    expect(mergeWorkIds({}, { arxiv: "1706.03762", arxivVersion: 7 })).toEqual({
      arxiv: "1706.03762",
    });
  });
});

describe("defaultVersionLabel", () => {
  it("arXiv 버전은 버전 번호를 붙인다", () => {
    expect(
      defaultVersionLabel({ kind: "preprint", ids: { arxiv: "1706.03762", arxivVersion: 2 } }),
    ).toBe("arXiv v2");
  });

  it("학회 버전은 venue 와 연도", () => {
    expect(defaultVersionLabel({ kind: "conference", ids: {}, venue: "ICLR", year: 2024 })).toBe(
      "ICLR 2024",
    );
  });

  it("정보가 없으면 업로드", () => {
    expect(defaultVersionLabel({ kind: "other", ids: {} })).toBe("업로드");
  });
});
