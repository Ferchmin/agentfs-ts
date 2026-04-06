import { NextRequest } from "next/server";
import { createUser, getUserByEmail, hashPassword, createToken, safeUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password, name } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password required" }, { status: 400 });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return Response.json({ error: "Email already registered" }, { status: 409 });
    }

    const user = await createUser({
      email,
      name: name || null,
      passwordHash: hashPassword(password),
    });

    const token = await createToken(user.id);
    return Response.json({ token, user: safeUser(user) });
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
