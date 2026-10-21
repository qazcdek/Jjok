// M0 완료 기준 점검 화면: 로그인 → 드라이브 업로드 → 다시 받기 (DevDocs/10-milestone-tasks.md M0)
// M1 에서 라이브러리 화면으로 대체한다.
import type { User } from "firebase/auth";
import { onSnapshot } from "firebase/firestore";
import { useEffect, useState } from "react";
import { signInWithGoogle, signOut, useAuthUser } from "../../lib/firebase/auth";
import type { WorkDoc } from "../../lib/schema";
import { UploadDropzone } from "../library/UploadDropzone";
import { worksCol } from "../works/refs";
import { WorkVersions } from "../works/WorkVersions";

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
  const [works, setWorks] = useState<{ id: string; work: WorkDoc }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () =>
      onSnapshot(
        worksCol(user.uid),
        (snap) => setWorks(snap.docs.map((d) => ({ id: d.id, work: d.data() as WorkDoc }))),
        (e) => setError(`목록 구독 실패: ${e.message}`),
      ),
    [user.uid],
  );

  return (
    <>
      <section className="card row">
        <div>
          <strong>{user.displayName ?? user.email}</strong>
          <div className="muted small">uid {user.uid}</div>
        </div>
        <button onClick={() => void signOut()}>로그아웃</button>
      </section>

      <UploadDropzone uid={user.uid} />

      <section className="card">
        <h2>논문 ({works.length})</h2>
        {error && <p className="error">{error}</p>}
        {works.length === 0 && <p className="muted">아직 없습니다.</p>}
        <ul className="works">
          {works.map(({ id, work }) => (
            <WorkVersions key={id} uid={user.uid} workId={id} work={work} />
          ))}
        </ul>
      </section>
    </>
  );
}
