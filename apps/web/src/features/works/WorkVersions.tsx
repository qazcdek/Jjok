// 논문 하나의 버전 목록: 기본 버전 지정, 버전 추가, 버전 삭제, 다시 받아 확인 (F-1.4, F-1.4.1)
// M1-09 의 라이브러리 목록 UI 가 나오기 전까지 M0 점검 화면에서 쓴다.
import { onSnapshot } from "firebase/firestore";
import { useEffect, useState, type ChangeEvent } from "react";
import { drive } from "../../lib/drive";
import { sha256Hex } from "../../lib/files/hash";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { uploadPdf } from "../library/uploads";
import { versionsCol } from "./refs";
import { deleteVersion, setPrimaryVersion } from "./versions";

type Check = "idle" | "checking" | "ok" | "mismatch" | "error";

interface Props {
  uid: string;
  workId: string;
  work: WorkDoc;
}

export function WorkVersions({ uid, workId, work }: Props) {
  const [versions, setVersions] = useState<(VersionDoc & { id: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  useEffect(
    () =>
      onSnapshot(
        versionsCol(uid, workId),
        (snap) =>
          setVersions(
            snap.docs
              .map((d) => ({ ...(d.data() as VersionDoc), id: d.id }))
              .sort((a, b) => (a.createdAt?.toMillis() ?? 0) - (b.createdAt?.toMillis() ?? 0)),
          ),
        (e) => setError(`버전 목록 구독 실패: ${e.message}`),
      ),
    [uid, workId],
  );

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  function onAddVersion(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) void run(() => uploadPdf(uid, file, { workId }));
  }

  function onDelete(v: VersionDoc & { id: string }) {
    const last = versions.length === 1;
    const message = last
      ? `마지막 버전입니다. "${work.title}" 논문까지 지우고 드라이브 파일도 지웁니다. 계속할까요?`
      : `"${v.label}" 버전과 드라이브 파일을 지웁니다. 계속할까요?`;
    if (window.confirm(message)) void run(() => deleteVersion(uid, workId, v.id));
  }

  async function verify(v: VersionDoc & { id: string }) {
    if (!v.driveFileId) return;
    setChecks((c) => ({ ...c, [v.id]: "checking" }));
    try {
      const blob = await drive.download(v.driveFileId);
      const ok = (await sha256Hex(blob)) === v.fileHash;
      setChecks((c) => ({ ...c, [v.id]: ok ? "ok" : "mismatch" }));
    } catch (e) {
      setError(String(e));
      setChecks((c) => ({ ...c, [v.id]: "error" }));
    }
  }

  return (
    <li className="work">
      <div className="row">
        <strong>{work.title}</strong>
        <label className="button small">
          버전 추가
          <input
            type="file"
            accept="application/pdf"
            onChange={onAddVersion}
            disabled={busy}
            hidden
          />
        </label>
      </div>
      <ul className="files">
        {versions.map((v) => {
          const primary = v.id === work.primaryVersionId;
          return (
            <li key={v.id} className={primary ? "primary-version" : undefined}>
              <span className="name">
                {v.label} <span className="muted small">· {v.fileName}</span>
              </span>
              <span className="muted small">{formatSize(v.fileSize)}</span>
              {primary ? (
                <span className="badge ok">기본</span>
              ) : (
                <button
                  disabled={busy}
                  onClick={() => void run(() => setPrimaryVersion(uid, workId, v.id))}
                >
                  기본으로 지정
                </button>
              )}
              <button onClick={() => void verify(v)} disabled={checks[v.id] === "checking"}>
                다시 받아 확인
              </button>
              <CheckBadge state={checks[v.id] ?? "idle"} />
              <button disabled={busy} onClick={() => onDelete(v)}>
                삭제
              </button>
            </li>
          );
        })}
      </ul>
      {busy && <span className="muted small">처리 중…</span>}
      {error && <p className="error">{error}</p>}
    </li>
  );
}

function CheckBadge({ state }: { state: Check }) {
  const label: Record<Check, string> = {
    idle: "",
    checking: "받는 중…",
    ok: "해시 일치",
    mismatch: "해시 불일치",
    error: "실패",
  };
  return state === "idle" ? null : <span className={`badge ${state}`}>{label[state]}</span>;
}

function formatSize(bytes?: number): string {
  if (bytes === undefined) return "";
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
