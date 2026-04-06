import { NextRequest } from "next/server";
import { requireAuth, createApiKey, listApiKeys, deleteApiKey, AuthError } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const { name, workspace } = await request.json();

    if (!name) {
      return Response.json({ error: "name required" }, { status: 400 });
    }

    const rawKey = await createApiKey(auth.userId, name, workspace || auth.workspace);
    return Response.json({ key: rawKey });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const keys = await listApiKeys(auth.userId);
    return Response.json({ keys });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const keyId = request.nextUrl.searchParams.get("id");

    if (!keyId) {
      return Response.json({ error: "id query param required" }, { status: 400 });
    }

    const deleted = await deleteApiKey(keyId, auth.userId);
    if (!deleted) {
      return Response.json({ error: "Key not found" }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
