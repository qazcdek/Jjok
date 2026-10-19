// M0 완료 기준 점검 화면: 로그인 → 드라이브 업로드 → 다시 받기 (DevDocs/10-milestone-tasks.md M0)
// M1 에서 라이브러리 화면으로 대체한다.
import type { User } from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { useEffect, useState, type ChangeEvent } from "react";
import { drive } from "../../lib/drive";
import { env } from "../../lib/env";
import { signInWithGoogle, signOut, useAuthUser } from "../../lib/firebase/auth";
import { sha256Hex } from "../../lib/files/hash";
import type { VersionDoc, WorkDoc } from "../../lib/schema";
import { uploadPdf, versionsCol, worksCol } from "../library/uploads";

interface Row {
  path: string;
  version: VersionDoc;
}

type Check = "idle" | "checking" | "ok" | "mismatch" | "error";

export function StorageCheck() {
  const { user, loading } = useAuthUser();
  if (loading) return <p className="muted">불러오는 중…</p>;
  return user ? <SignedIn user={user} /> : <SignedOut />;
}

function SignedOut() {
  const [error, setError] = useState<string | null>(null);
  return (
    <section className="card">
      <h2>로그인</h2>
      <p className="muted">
        Google 계정으로 로그인하고 드라이브(앱이 만든 파일만) 접근을 허용합니다.
      </p>
      <button
        onClick={() => signInWithGoogle().catch((e: unknown) => setError(String(e)))}
        className="primary"
      >
        Google로 로그인
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function SignedIn({ user }: { user: User }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, Check>>({});

  useEffect(() => {
    // 작품 목록을 구독하고, 각 작품의 대표 버전을 읽는다
    let cancelled = false;
    const unsubscribe = onSnapshot(
      worksCol(user.uid),
      async (snap) => {
        try {
          const loaded = await Promise.all(
            snap.docs.map(async (w) => {
              const work = w.data() as WorkDoc;
              const ref = doc(versionsCol(user.uid, w.id), work.primaryVersionId);
              const v = await getDoc(ref);
              return v.exists() ? { path: ref.path, version: v.data() as VersionDoc } : null;
            }),
          );
          if (!cancelled) setRows(loaded.filter((r): r is Row => r !== null));
        } catch (e) {
          if (!cancelled) setError(`목록을 읽지 못했습니다: ${String(e)}`);
        }
      },
      (e) => setError(`목록 구독 실패: ${e.message}`),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user.uid]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadPdf(user.uid, file);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify(row: Row) {
    const { driveFileId, fileHash } = row.version;
    if (!driveFileId) return;
    setChecks((c) => ({ ...c, [row.path]: "checking" }));
    try {
      const blob = await drive.download(driveFileId);
      const ok = (await sha256Hex(blob)) === fileHash;
      setChecks((c) => ({ ...c, [row.path]: ok ? "ok" : "mismatch" }));
    } catch (err) {
      setError(String(err));
      setChecks((c) => ({ ...c, [row.path]: "error" }));
    }
  }

  return (
    <>
      <section className="card row">
        <div>
          <strong>{user.displayName ?? user.email}</strong>
          <div className="muted small">uid {user.uid}</div>
        </div>
        <button onClick={() => void signOut()}>로그아웃</button>
      </section>

      <section className="card">
        <h2>드라이브 업로드</h2>
        <p className="muted small">
          저장 위치: /Jjok/files/&lt;workId&gt;/&lt;versionId&gt;.pdf · 드라이브 백엔드:{" "}
          <code>{env.driveBackend}</code>
          {env.driveBackend === "memory" && " (메모리 — 새로고침하면 파일이 사라짐)"}
        </p>
        <input type="file" accept="application/pdf" onChange={onFile} disabled={busy} />
        {busy && <span className="muted"> 업로드 중…</span>}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="card">
        <h2>올린 파일 ({rows.length})</h2>
        {rows.length === 0 && <p className="muted">아직 없습니다.</p>}
        <ul className="files">
          {rows.map((row) => (
            <li key={row.path}>
              <span className="name">{row.version.fileName}</span>
              <span className="muted small">{formatSize(row.version.fileSize)}</span>
              <button onClick={() => void verify(row)} disabled={checks[row.path] === "checking"}>
                다시 받아 확인
              </button>
              <CheckBadge state={checks[row.path] ?? "idle"} />
            </li>
          ))}
        </ul>
      </section>
    </>
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
