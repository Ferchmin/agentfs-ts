import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const commitId = request.nextUrl.searchParams.get("commit");
    if (!commitId) {
      return Response.json({ error: "commit query param required" }, { status: 400 });
    }

    const diffText = await storage.diff(commitId);
    return new Response(diffText, {
      headers: { "Content-Type": "text/plain" },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
