import { v2 as cloudinary } from "cloudinary";

function env(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  return v;
}

export function isCloudinaryConfigured(): boolean {
  return Boolean(env("CLOUDINARY_CLOUD_NAME") && env("CLOUDINARY_API_KEY") && env("CLOUDINARY_API_SECRET"));
}

export function configureCloudinary(): void {
  if (!isCloudinaryConfigured()) return;

  cloudinary.config({
    cloud_name: env("CLOUDINARY_CLOUD_NAME"),
    api_key: env("CLOUDINARY_API_KEY"),
    api_secret: env("CLOUDINARY_API_SECRET"),
    secure: true,
  });
}

export type CloudinaryUploadResult = {
  secureUrl: string;
  publicId: string;
  resourceType: string;
  bytes: number;
};

export async function uploadBufferToCloudinary(args: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  folder?: string;
  resourceType?: "auto" | "image" | "raw" | "video";
}): Promise<CloudinaryUploadResult> {
  configureCloudinary();
  if (!isCloudinaryConfigured()) throw new Error("Cloudinary not configured");

  const { buffer, filename, mimeType, folder, resourceType } = args;

  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType ?? "auto",
        filename_override: filename,
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        context: { original_mime_type: mimeType },
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error("Cloudinary upload failed"));
        resolve({
          secureUrl: result.secure_url,
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes ?? buffer.length,
        });
      }
    );

    stream.end(buffer);
  });
}

export function cloudinaryDownloadUrl(args: { publicId: string; resourceType: string; filename?: string }): string {
  configureCloudinary();
  return cloudinary.url(args.publicId, {
    secure: true,
    resource_type: args.resourceType as any,
    flags: "attachment",
    // Cloudinary will set a sensible attachment filename; optional override:
    attachment: args.filename,
  });
}

export function cloudinarySignedViewUrl(args: { publicId: string; resourceType: string }): string {
  configureCloudinary();
  return cloudinary.url(args.publicId, {
    secure: true,
    sign_url: true,
    resource_type: args.resourceType as any,
  });
}

export function cloudinarySignedDownloadUrl(args: { publicId: string; resourceType: string; filename?: string }): string {
  configureCloudinary();
  return cloudinary.url(args.publicId, {
    secure: true,
    sign_url: true,
    resource_type: args.resourceType as any,
    flags: "attachment",
    attachment: args.filename,
  });
}
