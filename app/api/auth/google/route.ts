import { NextRequest } from "next/server";
import { getUserByProvider, getUserByEmail, createUser, createToken, safeUser } from "@/lib/auth";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";

export async function POST(request: NextRequest) {
  try {
    const { code, redirect_uri } = await request.json();
    if (!code) {
      return Response.json({ error: "Code required" }, { status: 400 });
    }

    // Exchange code for token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirect_uri || "",
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.json({ error: "Google OAuth failed" }, { status: 401 });
    }

    // Get user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const gUser = await userRes.json();

    // Find or create user
    let user = await getUserByProvider("google", gUser.id);
    if (!user && gUser.email) {
      user = await getUserByEmail(gUser.email);
    }
    if (!user) {
      user = await createUser({
        email: gUser.email,
        name: gUser.name,
        provider: "google",
        providerId: gUser.id,
        avatarUrl: gUser.picture,
      });
    }

    const token = await createToken(user.id);
    return Response.json({ token, user: safeUser(user) });
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
