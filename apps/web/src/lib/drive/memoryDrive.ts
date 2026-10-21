// 에뮬레이터·테스트용 드라이브 구현. 데이터는 탭 메모리에만 있다 (새로고침하면 사라짐).
import {
  APP_FOLDER_NAME,
  type AppFolders,
  type DriveClient,
  DriveError,
  FILES_FOLDER_NAME,
  type UploadPdfParams,
} from "./types";

interface Entry {
  name: string;
  parentId: string;
  blob?: Blob;
}

export class MemoryDriveClient implements DriveClient {
  private readonly entries = new Map<string, Entry>();
  private seq = 0;

  async ensureAppFolders(cached?: Partial<AppFolders>): Promise<AppFolders> {
    const rootFolderId =
      cached?.rootFolderId && this.entries.has(cached.rootFolderId)
        ? cached.rootFolderId
        : this.findOrCreate(APP_FOLDER_NAME, "root");
    const filesFolderId =
      cached?.filesFolderId && this.entries.has(cached.filesFolderId)
        ? cached.filesFolderId
        : this.findOrCreate(FILES_FOLDER_NAME, rootFolderId);
    return { rootFolderId, filesFolderId };
  }

  async uploadPdf({ folders, workId, versionId, file }: UploadPdfParams) {
    const workFolderId = this.findOrCreate(workId, folders.filesFolderId);
    const fileId = this.nextId();
    this.entries.set(fileId, { name: `${versionId}.pdf`, parentId: workFolderId, blob: file });
    return { fileId };
  }

  async download(fileId: string): Promise<Blob> {
    const blob = this.entries.get(fileId)?.blob;
    if (!blob) throw new DriveError(404, `파일 없음: ${fileId}`);
    return blob;
  }

  async remove(fileId: string): Promise<void> {
    if (!this.entries.delete(fileId)) throw new DriveError(404, `파일 없음: ${fileId}`);
  }

  async removeWorkFolderIfEmpty(folders: AppFolders, workId: string): Promise<boolean> {
    const folderId = this.findFolder(workId, folders.filesFolderId);
    if (!folderId) return false;
    for (const e of this.entries.values()) if (e.parentId === folderId) return false;
    this.entries.delete(folderId);
    return true;
  }

  /** 테스트용: 경로 문자열로 조회 (예: "Jjok/files/w1/v1.pdf") */
  pathOf(fileId: string): string | undefined {
    const parts: string[] = [];
    let cur = this.entries.get(fileId);
    while (cur) {
      parts.unshift(cur.name);
      cur = this.entries.get(cur.parentId);
    }
    return parts.length ? parts.join("/") : undefined;
  }

  private findFolder(name: string, parentId: string): string | undefined {
    for (const [id, e] of this.entries) {
      if (!e.blob && e.name === name && e.parentId === parentId) return id;
    }
    return undefined;
  }

  private findOrCreate(name: string, parentId: string): string {
    const existing = this.findFolder(name, parentId);
    if (existing) return existing;
    const id = this.nextId();
    this.entries.set(id, { name, parentId });
    return id;
  }

  private nextId(): string {
    this.seq += 1;
    return `mem-${this.seq}`;
  }
}
