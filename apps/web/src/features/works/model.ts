// 작품·판 규칙 (순수 함수). DevDocs/03-data-model.md §3.2·§3.3, F-1.4
import type { VersionDoc, WorkDoc } from "../../lib/schema";

export type VersionKind = VersionDoc["kind"];

/** 대표 버전 자동 선택 순서: 최종본에 가까울수록 앞 (F-1.4.1 기본값, 사용자가 바꿀 수 있다) */
const KIND_RANK: Record<VersionKind, number> = {
  journal: 0,
  conference: 1,
  workshop: 2,
  preprint: 3,
  other: 4,
};

export interface VersionLike {
  id: string;
  kind: VersionKind;
  year?: number;
  ids?: VersionDoc["ids"];
}

/**
 * 대표로 쓸 판을 고른다. 종류 순위 → 연도 최신 → arXiv 버전 최신 → id 순.
 * 대표 버전을 지울 때 남은 판 중에서 새 대표를 고르는 데 쓴다.
 */
export function pickPrimaryVersion<T extends VersionLike>(versions: readonly T[]): T | undefined {
  return [...versions].sort(
    (a, b) =>
      KIND_RANK[a.kind] - KIND_RANK[b.kind] ||
      (b.year ?? 0) - (a.year ?? 0) ||
      (b.ids?.arxivVersion ?? 0) - (a.ids?.arxivVersion ?? 0) ||
      a.id.localeCompare(b.id),
  )[0];
}

/**
 * 판의 식별자를 작품 식별자에 합친다. 작품에 이미 있는 값은 덮어쓰지 않는다.
 * 작품은 모든 판의 식별자를 모아 두어 매칭(F-2.3)에 쓴다.
 */
export function mergeWorkIds(
  workIds: WorkDoc["ids"],
  versionIds: VersionDoc["ids"],
): WorkDoc["ids"] {
  const merged: WorkDoc["ids"] = { ...workIds };
  if (versionIds.doi && !merged.doi) merged.doi = versionIds.doi;
  if (versionIds.arxiv && !merged.arxiv) merged.arxiv = versionIds.arxiv;
  if (versionIds.openreview && !merged.openreview) merged.openreview = versionIds.openreview;
  return merged;
}

/** 판 표시 이름 기본값: `arXiv v2`, `ICLR 2024`, 없으면 `업로드` */
export function defaultVersionLabel(
  version: Pick<VersionDoc, "kind" | "ids" | "venue" | "year">,
): string {
  if (version.kind === "preprint" && version.ids.arxiv) {
    return version.ids.arxivVersion ? `arXiv v${version.ids.arxivVersion}` : "arXiv";
  }
  const parts = [version.venue, version.year].filter((p) => p !== undefined && p !== "");
  return parts.length > 0 ? parts.join(" ") : "업로드";
}
