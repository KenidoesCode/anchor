import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

/**
 * Certificate document storage behind an adapter interface.
 *  - local  (default): filesystem, for the demo.
 *  - s3     (config-selected): unused without credentials; throws clearly if
 *           selected without them.
 * Selected via STORAGE_ADAPTER. File type/size are validated by the CALLER on
 * the server (never trust the client); this layer only stores/reads bytes.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

const UPLOAD_DIR = resolve(process.env.GS_UPLOAD_DIR ?? ".uploads");

const localAdapter: StorageAdapter = {
  async put(key, data) {
    const path = join(UPLOAD_DIR, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  },
  async get(key) {
    try {
      return await readFile(join(UPLOAD_DIR, key));
    } catch {
      return null;
    }
  },
};

const s3Adapter: StorageAdapter = {
  async put() {
    throw new Error("S3 storage is selected but not configured. Set AWS credentials, or use STORAGE_ADAPTER=local for the demo.");
  },
  async get() {
    throw new Error("S3 storage is selected but not configured.");
  },
};

export function getStorage(): StorageAdapter {
  return process.env.STORAGE_ADAPTER === "s3" ? s3Adapter : localAdapter;
}

export const ALLOWED_DOCUMENT_TYPES = ["application/pdf", "image/png", "image/jpeg"];
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export function extensionFor(contentType: string): string {
  return contentType === "application/pdf" ? "pdf" : contentType === "image/png" ? "png" : "jpg";
}
