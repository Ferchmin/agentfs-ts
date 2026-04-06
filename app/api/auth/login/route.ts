import { NextRequest } from "next/server";
import { getUserByEmail, verifyPassword, createToken, safeUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return Response.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await getUserByEmail(email);
    if (!user || !user.password_hash) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createToken(user.id);
    return Response.json({ token, user: safeUser(user) });
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
