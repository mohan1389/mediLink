import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ fileUploadId: string }> }
) {
  const { userId } = await auth();
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { fileUploadId } = await params;

  const apiRes = await fetch(`${API_BASE}/files/${encodeURIComponent(fileUploadId)}/view`, {
    headers: { "x-user-id": userId },
    redirect: "follow",
  });

  if (!apiRes.ok) {
    return new NextResponse(apiRes.body, {
      status: apiRes.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = apiRes.headers.get("Content-Type") ?? "application/octet-stream";
  const contentDisp = apiRes.headers.get("Content-Disposition") ?? "";

  // Force inline so the browser renders instead of downloading
  const filename = contentDisp.match(/filename="?([^"]+)"?/)?.[1] ?? fileUploadId;
  const inlineHeader = `inline; filename="${filename}"`;

  const body = await apiRes.arrayBuffer();

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": inlineHeader,
      "Cache-Control": "private, max-age=300",
    },
  });
}
