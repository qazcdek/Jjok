// 업로드 대기열: 여러 PDF 를 차례로 올리고 파일별 상태를 보여 준다 (M1-02, F-1.2)
import { useCallback, useRef, useState } from "react";
import { warmDriveToken } from "../../lib/drive";
import { uploadPdf, type UploadOptions } from "./uploads";

export type UploadStatus =
  | { kind: "waiting" }
  | { kind: "uploading" }
  | { kind: "done"; workId: string }
  | { kind: "duplicate"; workId: string; title: string }
  | { kind: "rejected"; reason: string }
  | { kind: "error"; message: string };

export interface UploadItem {
  id: number;
  name: string;
  status: UploadStatus;
}

/** PDF 만 받는다. 드래그 앤 드롭은 type 이 비어 있는 경우가 있어 확장자도 본다 */
export function isPdf(file: Pick<File, "name" | "type">): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function statusLabel(status: UploadStatus): string {
  switch (status.kind) {
    case "waiting":
      return "대기 중";
    case "uploading":
      return "올리는 중…";
    case "done":
      return "완료";
    case "duplicate":
      return `이미 있음: ${status.title}`;
    case "rejected":
      return status.reason;
    case "error":
      return `실패: ${status.message}`;
  }
}

/** 파일을 한 번에 하나씩 올린다. 같은 파일을 연달아 넣어도 앞의 업로드가 끝난 뒤 중복 검사를 한다 */
export function useUploadQueue(uid: string) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const seq = useRef(0);
  const tail = useRef<Promise<void>>(Promise.resolve());

  const update = (id: number, status: UploadStatus) =>
    setItems((list) => list.map((it) => (it.id === id ? { ...it, status } : it)));

  const add = useCallback(
    (files: readonly File[], options: UploadOptions = {}) => {
      if (files.length === 0) return;
      // 핸들러 안에서 바로 토큰을 받아 둔다 (팝업 차단 방지)
      const token = warmDriveToken();
      const entries = files.map((file) => ({ id: ++seq.current, file }));
      setItems((list) => [
        ...list,
        ...entries.map(({ id, file }) => ({
          id,
          name: file.name,
          status: isPdf(file)
            ? ({ kind: "waiting" } as const)
            : ({ kind: "rejected", reason: "PDF가 아님" } as const),
        })),
      ]);
      tail.current = tail.current.then(async () => {
        try {
          await token;
        } catch (e) {
          for (const { id, file } of entries) {
            if (isPdf(file)) update(id, { kind: "error", message: String(e) });
          }
          return;
        }
        for (const { id, file } of entries) {
          if (!isPdf(file)) continue;
          update(id, { kind: "uploading" });
          try {
            const result = await uploadPdf(uid, file, options);
            update(
              id,
              result.kind === "duplicate"
                ? { kind: "duplicate", workId: result.workId, title: result.title }
                : { kind: "done", workId: result.workId },
            );
          } catch (e) {
            update(id, { kind: "error", message: String(e) });
          }
        }
      });
    },
    [uid],
  );

  const clearFinished = useCallback(
    () =>
      setItems((list) =>
        list.filter((it) => it.status.kind === "waiting" || it.status.kind === "uploading"),
      ),
    [],
  );

  return { items, add, clearFinished };
}
