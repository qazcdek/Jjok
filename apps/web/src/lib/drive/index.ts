import { env } from "../env";
import { GoogleDriveClient } from "./googleDrive";
import { MemoryDriveClient } from "./memoryDrive";
import { GoogleTokenProvider } from "./token";
import type { DriveClient } from "./types";

export * from "./types";
export { DRIVE_SCOPE } from "./token";

export const driveTokens = new GoogleTokenProvider(env.googleOAuthClientId);

export const drive: DriveClient =
  env.driveBackend === "google" ? new GoogleDriveClient(driveTokens) : new MemoryDriveClient();

/**
 * 드라이브 토큰을 미리 받아 둔다. 클릭·드롭 핸들러에서 다른 await 보다 먼저 부른다.
 * 토큰 재발급이 팝업을 띄울 수 있는데, 브라우저는 사용자 동작 직후의 팝업만 허용한다 (I-03, I-17).
 */
export async function warmDriveToken(): Promise<void> {
  if (env.driveBackend === "google") await driveTokens.getToken();
}
