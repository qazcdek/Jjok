import { describe, expect, it } from "vitest";
import { sha256Hex } from "../files/hash";
import { MemoryDriveClient } from "./memoryDrive";

describe("MemoryDriveClient", () => {
  it("올린 파일을 /Jjok/files/<workId>/<versionId>.pdf 에 두고 그대로 돌려준다", async () => {
    const drive = new MemoryDriveClient();
    const folders = await drive.ensureAppFolders();
    const file = new Blob(["hello pdf"]);
    const { fileId } = await drive.uploadPdf({ folders, workId: "w1", versionId: "v1", file });
    expect(drive.pathOf(fileId)).toBe("Jjok/files/w1/v1.pdf");
    expect(await sha256Hex(await drive.download(fileId))).toBe(await sha256Hex(file));
  });

  it("같은 폴더를 두 번 만들지 않는다", async () => {
    const drive = new MemoryDriveClient();
    const a = await drive.ensureAppFolders();
    const b = await drive.ensureAppFolders();
    expect(b).toEqual(a);
  });
});
