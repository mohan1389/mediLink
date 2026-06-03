import { auth } from "@clerk/nextjs/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export async function GET(
  _req: Request,
  context: { params: { fileUploadId: string } } | { params: Promise<{ fileUploadId: string }> }
): Promise<Response> {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const maybeParams = (context as any).params;
  const resolvedParams = typeof maybeParams?.then === "function" ? await maybeParams : maybeParams;
  const fileUploadId = String(resolvedParams?.fileUploadId ?? "");
  if (!fileUploadId) return new Response("Bad Request", { status: 400 });

  const upstream = await fetch(`${API_BASE_URL}/files/${fileUploadId}/download`, {
    headers: {
      "x-user-id": userId,
    },
    cache: "no-store",
    redirect: "manual",
  });

  const location = upstream.headers.get("location");
  if (location && upstream.status >= 300 && upstream.status < 400) {
    return Response.redirect(location, upstream.status);
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  const contentDisposition = upstream.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (contentDisposition) headers.set("content-disposition", contentDisposition);

  return new Response(upstream.body, {
    status: upstream.status,
    headers,
  });
}
