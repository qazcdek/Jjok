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
