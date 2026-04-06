import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const query = request.nextUrl.searchParams.get("q") || "";
    if (!query) {
      return Response.json({ error: "q query param required" }, { status: 400 });
    }

    const results = await storage.search(query);
    return Response.json({ results });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
