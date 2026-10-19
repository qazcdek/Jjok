import type { AccessTokenProvider } from "./token";
import {
  APP_FOLDER_NAME,
  type AppFolders,
  type DriveClient,
  DriveError,
  FILES_FOLDER_NAME,
  type UploadPdfParams,
} from "./types";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
/** 이 크기 이하는 multipart 한 번, 초과는 resumable 업로드 (DevDocs/06-frontend.md §8) */
export const MULTIPART_LIMIT = 5 * 1024 * 1024;

type Fetch = typeof fetch;

/** Drive 검색 쿼리 문자열 리터럴 이스케이프 */
export function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export class GoogleDriveClient implements DriveClient {
  constructor(
    private readonly tokens: AccessTokenProvider,
    private readonly fetchFn: Fetch = (...args) => fetch(...args),
  ) {}

  async ensureAppFolders(cached?: Partial<AppFolders>): Promise<AppFolders> {
    let rootFolderId = cached?.rootFolderId;
    if (!rootFolderId || !(await this.isLiveFolder(rootFolderId))) {
      rootFolderId = await this.findOrCreateFolder(APP_FOLDER_NAME, "root");
    }
    let filesFolderId = cached?.filesFolderId;
    if (!filesFolderId || !(await this.isLiveFolder(filesFolderId))) {
      filesFolderId = await this.findOrCreateFolder(FILES_FOLDER_NAME, rootFolderId);
    }
    return { rootFolderId, filesFolderId };
  }

  async uploadPdf({
    folders,
    workId,
    versionId,
    file,
  }: UploadPdfParams): Promise<{ fileId: string }> {
    const workFolderId = await this.findOrCreateFolder(workId, folders.filesFolderId);
    const metadata = {
      name: `${versionId}.pdf`,
      mimeType: "application/pdf",
      parents: [workFolderId],
    };
    const fileId =
      file.size <= MULTIPART_LIMIT
        ? await this.uploadMultipart(metadata, file)
        : await this.uploadResumable(metadata, file);
    return { fileId };
  }

  async download(fileId: string): Promise<Blob> {
    const res = await this.request(`${API}/files/${encodeURIComponent(fileId)}?alt=media`);
    return res.blob();
  }

  async remove(fileId: string): Promise<void> {
    await this.request(`${API}/files/${encodeURIComponent(fileId)}`, { method: "DELETE" });
  }

  // ── 내부 ──────────────────────────────────────────────

  private async isLiveFolder(id: string): Promise<boolean> {
    try {
      const res = await this.request(`${API}/files/${encodeURIComponent(id)}?fields=id,trashed`);
      const body = (await res.json()) as { trashed?: boolean };
      return !body.trashed;
    } catch (e) {
      if (e instanceof DriveError && e.status === 404) return false;
      throw e;
    }
  }

  private async findOrCreateFolder(name: string, parentId: string): Promise<string> {
    const q = [
      `name = '${escapeQuery(name)}'`,
      `mimeType = '${FOLDER_MIME}'`,
      "trashed = false",
      `'${escapeQuery(parentId)}' in parents`,
    ].join(" and ");
    const params = new URLSearchParams({ q, fields: "files(id)", spaces: "drive", pageSize: "1" });
    const found = (await (await this.request(`${API}/files?${params}`)).json()) as {
      files: { id: string }[];
    };
    if (found.files[0]) return found.files[0].id;

    const res = await this.request(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
    });
    return ((await res.json()) as { id: string }).id;
  }

  private async uploadMultipart(metadata: object, file: Blob): Promise<string> {
    const boundary = `jjok-${crypto.randomUUID()}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      JSON.stringify(metadata),
      `\r\n--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      file,
      `\r\n--${boundary}--`,
    ]);
    const res = await this.request(`${UPLOAD_API}/files?uploadType=multipart&fields=id`, {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    });
    return ((await res.json()) as { id: string }).id;
  }

  private async uploadResumable(metadata: object, file: Blob): Promise<string> {
    const init = await this.request(`${UPLOAD_API}/files?uploadType=resumable&fields=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "application/pdf",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    });
    const location = init.headers.get("Location");
    if (!location) throw new DriveError(0, "resumable 업로드 세션 주소를 받지 못했습니다.");
    // v1: 한 번에 전송. 끊김 재개는 필요해지면 추가한다.
    const res = await this.request(location, {
      method: "PUT",
      headers: { "Content-Type": "application/pdf" },
      body: file,
    });
    return ((await res.json()) as { id: string }).id;
  }

  /** 인증 헤더를 붙여 호출. 401 이면 토큰을 버리고 한 번 재시도한다. */
  private async request(url: string, init: RequestInit = {}, retried = false): Promise<Response> {
    const token = await this.tokens.getToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await this.fetchFn(url, { ...init, headers });
    if (res.status === 401 && !retried) {
      this.tokens.invalidate();
      return this.request(url, init, true);
    }
    if (!res.ok) {
      throw new DriveError(res.status, `Drive 요청 실패 (${res.status}): ${await res.text()}`);
    }
    return res;
  }
}
