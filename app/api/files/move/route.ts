import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage, FileNotFoundError } from "@/lib/storage";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const { src, dst, message } = await request.json();
    if (!src || !dst) {
      return Response.json({ error: "src and dst required" }, { status: 400 });
    }

    const result = await storage.move(src, dst, { message });
    return Response.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof FileNotFoundError) {
      return Response.json({ error: err.message }, { status: 404 });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
