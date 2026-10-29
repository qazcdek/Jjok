// 논문 정보 확인·수정 패널 (M1-T5, F-1.2). 논문 카드의 "정보 확인"/"정보 수정" 버튼으로 연다.
import { useState, type FormEvent } from "react";
import type { PaperMetadata, WorkDoc } from "../../lib/schema";
import {
  authorsText,
  confirmAsIs,
  confirmCandidate,
  saveManual,
  searchCandidates,
  type ManualInput,
} from "./review";

interface Props {
  uid: string;
  workId: string;
  work: WorkDoc;
  onClose: () => void;
}

const SOURCE_LABEL: Record<PaperMetadata["source"], string> = {
  arxiv: "arXiv",
  crossref: "Crossref",
  openalex: "OpenAlex",
  s2: "Semantic Scholar",
};

export function MetadataReview({ uid, workId, work, onClose }: Props) {
  const [query, setQuery] = useState(work.ids.doi ?? work.ids.arxiv ?? work.title);
  const [candidates, setCandidates] = useState<PaperMetadata[] | null>(null);
  const [manual, setManual] = useState<ManualInput>({
    title: work.title,
    authors: work.authors.map((a) => a.name).join(", "),
    year: work.year?.toString() ?? "",
    venue: work.venue ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, { close = false } = {}) {
    setBusy(true);
    setError(null);
    try {
      await action();
      if (close) onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void run(async () => setCandidates(await searchCandidates(query)));
  }

  function onSave(e: FormEvent) {
    e.preventDefault();
    void run(() => saveManual(uid, workId, work, manual), { close: true });
  }

  const field = (key: keyof ManualInput) => ({
    value: manual[key],
    onChange: (e: { target: { value: string } }) =>
      setManual((m) => ({ ...m, [key]: e.target.value })),
  });

  return (
    <div className="review" data-testid="metadata-review">
      <form className="review-search" onSubmit={onSearch}>
        <input
          aria-label="DOI, arXiv ID 또는 제목"
          placeholder="DOI, arXiv ID 또는 제목"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={busy || !query.trim()}>
          다시 찾기
        </button>
      </form>

      {candidates && candidates.length === 0 && (
        <p className="muted small">찾지 못했습니다. 아래에 직접 입력하세요.</p>
      )}
      {candidates && candidates.length > 0 && (
        <ul className="candidates">
          {candidates.map((c, i) => (
            <li key={`${c.source}-${i}`}>
              <div className="name">
                <strong>{c.title}</strong>
                <div className="muted small">
                  {[authorsText(c.authors), c.venue, c.year].filter(Boolean).join(" · ")}
                </div>
                <div className="muted small">
                  {SOURCE_LABEL[c.source]}
                  {c.score !== undefined && ` · 제목 일치 ${Math.round(c.score * 100)}%`}
                </div>
              </div>
              <button
                disabled={busy}
                onClick={() =>
                  void run(() => confirmCandidate(uid, workId, work, c), { close: true })
                }
              >
                이 정보로 저장
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="review-manual" onSubmit={onSave}>
        <label>
          제목
          <input {...field("title")} required />
        </label>
        <label>
          저자 <span className="muted small">(쉼표로 구분)</span>
          <input {...field("authors")} />
        </label>
        <div className="review-row">
          <label>
            연도
            <input {...field("year")} inputMode="numeric" maxLength={4} />
          </label>
          <label>
            학회·저널
            <input {...field("venue")} />
          </label>
        </div>
        <div className="review-actions">
          <button type="submit" className="primary" disabled={busy}>
            입력한 정보로 저장
          </button>
          {work.needsReview && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => confirmAsIs(uid, workId), { close: true })}
            >
              지금 정보가 맞음
            </button>
          )}
          <button type="button" onClick={onClose}>
            닫기
          </button>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
