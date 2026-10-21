// PDF 드래그 앤 드롭 업로드 (M1-02, F-1.2). 파일 선택 버튼도 같은 대기열로 들어간다.
import { useState, type ChangeEvent, type DragEvent } from "react";
import { env } from "../../lib/env";
import { isActive, statusLabel, useUploadQueue, type UploadItem } from "./uploadQueue";

export function UploadDropzone({ uid }: { uid: string }) {
  const { items, add, clearFinished } = useUploadQueue(uid);
  const [dragging, setDragging] = useState(false);

  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    add(Array.from(e.dataTransfer.files));
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    add(files);
  }

  const finished = items.some((it) => !isActive(it.status));

  return (
    <section className="card">
      <h2>논문 올리기</h2>
      <div
        className={`dropzone${dragging ? " dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="dropzone"
      >
        <p>PDF를 여기에 끌어다 놓으세요. 여러 개를 한 번에 올릴 수 있습니다.</p>
        <label className="button">
          파일 선택
          <input type="file" accept="application/pdf,.pdf" multiple onChange={onPick} hidden />
        </label>
      </div>
      <p className="muted small">
        같은 파일이 이미 있으면 올리지 않습니다. 저장 위치: 내 드라이브 /Jjok/files
        {env.driveBackend === "memory" && " (메모리 드라이브 — 새로고침하면 파일이 사라짐)"}
      </p>
      {items.length > 0 && (
        <>
          <ul className="files upload-queue">
            {items.map((it) => (
              <QueueRow key={it.id} item={it} />
            ))}
          </ul>
          {finished && (
            <button className="small" onClick={clearFinished}>
              끝난 항목 지우기
            </button>
          )}
        </>
      )}
    </section>
  );
}

function QueueRow({ item }: { item: UploadItem }) {
  const tone: Record<UploadItem["status"]["kind"], string> = {
    waiting: "checking",
    uploading: "checking",
    lookup: "checking",
    done: "ok",
    duplicate: "warn",
    rejected: "warn",
    error: "error",
  };
  return (
    <li>
      <span className="name">{item.name}</span>
      <span className={`badge ${tone[item.status.kind]}`}>{statusLabel(item.status)}</span>
    </li>
  );
}
