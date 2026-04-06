/**
 * File CRUD — PUT (write), GET (read), DELETE.
 * Path is passed as ?path= query param.
 */

import { NextRequest } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth";
import { Storage, FileNotFoundError } from "@/lib/storage";

export async function PUT(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const filePath = request.nextUrl.searchParams.get("path");
    if (!filePath) {
      return Response.json({ error: "path query param required" }, { status: 400 });
    }

    const contentType = request.headers.get("content-type") || "";
    let content: Buffer;
    let message: string | undefined;
    let agent: string | undefined;
    let conversation: string | undefined;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      content = Buffer.from(body.content || "", "utf-8");
      message = body.message;
      agent = body.agent;
      conversation = body.conversation;
    } else {
      content = Buffer.from(await request.arrayBuffer());
    }

    const result = await storage.write(filePath, content, { message, agent, conversation });
    return Response.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("PUT /api/files error:", msg, err);
    return Response.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const filePath = request.nextUrl.searchParams.get("path");
    if (!filePath) {
      return Response.json({ error: "path query param required" }, { status: 400 });
    }

    const version = request.nextUrl.searchParams.get("version") || undefined;
    const data = await storage.read(filePath, version);

    // Return as text if it looks like text, otherwise binary
    const text = request.nextUrl.searchParams.get("format") === "text";
    if (text) {
      return new Response(data.toString("utf-8"), {
        headers: { "Content-Type": "text/plain" },
      });
    }
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Length": String(data.length),
      },
    });
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    const storage = new Storage(auth.userId, auth.workspace);

    const filePath = request.nextUrl.searchParams.get("path");
    if (!filePath) {
      return Response.json({ error: "path query param required" }, { status: 400 });
    }

    const result = await storage.delete(filePath);
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
