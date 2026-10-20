// 드라이브 구조: /Jjok/files/<workId>/<versionId>.pdf (DevDocs/03-data-model.md §4)

export const APP_FOLDER_NAME = "Jjok";
export const FILES_FOLDER_NAME = "files";

export interface AppFolders {
  rootFolderId: string;
  filesFolderId: string;
}

export interface UploadPdfParams {
  folders: AppFolders;
  workId: string;
  versionId: string;
  file: Blob;
}

export interface DriveClient {
  /** /Jjok, /Jjok/files 폴더를 확인하고 없으면 만든다. cached 가 유효하면 그대로 돌려준다 */
  ensureAppFolders(cached?: Partial<AppFolders>): Promise<AppFolders>;
  uploadPdf(params: UploadPdfParams): Promise<{ fileId: string }>;
  download(fileId: string): Promise<Blob>;
  remove(fileId: string): Promise<void>;
  /** 논문 폴더(/Jjok/files/<workId>)가 비어 있으면 지운다. 지웠으면 true (DevDocs/09-open-issues.md I-16) */
  removeWorkFolderIfEmpty(folders: AppFolders, workId: string): Promise<boolean>;
}

export class DriveError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DriveError";
  }
}
