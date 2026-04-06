import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const path = request.nextUrl.searchParams.get("path") || "/";
    const entries = await storage.list(path);
    return Response.json({ entries });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
