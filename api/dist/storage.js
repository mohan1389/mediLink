import fs from "node:fs/promises";
import path from "node:path";
export function getUploadsRoot() {
    // Running from apps/api; store files under repo-root/storage/uploads
    return path.resolve(process.cwd(), "..", "..", "storage", "uploads");
}
export async function ensureUploadsRoot() {
    await fs.mkdir(getUploadsRoot(), { recursive: true });
}
