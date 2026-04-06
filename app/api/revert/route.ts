import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const { commit_id } = await request.json();
    if (!commit_id) {
      return Response.json({ error: "commit_id required" }, { status: 400 });
    }

    const result = await storage.revert(commit_id);
    return Response.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
