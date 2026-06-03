import fs from "node:fs/promises";
import path from "node:path";

import { ensureUploadsRoot, getUploadsRoot } from "./storage.js";
import { isCloudinaryConfigured, uploadBufferToCloudinary } from "./cloudinary.js";

export type StoredFile =
  | {
      provider: "LOCAL";
      storagePath: string;
      publicId?: undefined;
      resourceType?: undefined;
      url?: undefined;
    }
  | {
      provider: "CLOUDINARY";
      storagePath: string; // secure URL
      publicId: string;
      resourceType: string;
      url: string;
    };

export async function storePatientFile(args: {
  patientId: string;
  originalName: string;
  mimeType: string;
  buffer: Buffer;
  preferredResourceType?: "auto" | "raw";
}): Promise<StoredFile> {
  const { patientId, originalName, mimeType, buffer } = args;

  if (isCloudinaryConfigured()) {
    const folder = process.env.CLOUDINARY_FOLDER ?? "medilink";
    const isImage = mimeType.startsWith("image/");
    const resourceType = args.preferredResourceType ?? (isImage ? "auto" : "raw");
    const result = await uploadBufferToCloudinary({
      buffer,
      filename: originalName,
      mimeType,
      folder: `${folder}/patients/${patientId}`,
      resourceType,
    });

    return {
      provider: "CLOUDINARY",
      storagePath: result.secureUrl,
      publicId: result.publicId,
      resourceType: result.resourceType,
      url: result.secureUrl,
    };
  }

  await ensureUploadsRoot();
  const uploadId = `upl_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const patientDir = path.join(getUploadsRoot(), patientId);
  await fs.mkdir(patientDir, { recursive: true });
  const storagePath = path.join(patientDir, `${uploadId}_${safeName}`);
  await fs.writeFile(storagePath, buffer);

  return {
    provider: "LOCAL",
    storagePath,
  };
}
