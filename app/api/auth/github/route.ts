import { NextRequest } from "next/server";
import { getUserByProvider, getUserByEmail, createUser, createToken, safeUser } from "@/lib/auth";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || "";

export async function GET(request: NextRequest) {
  // Redirect to GitHub OAuth
  const redirectUri = `${request.nextUrl.origin}/api/auth/github?callback=1`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  return Response.redirect(url);
}

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();
    if (!code) {
      return Response.json({ error: "Code required" }, { status: 400 });
    }

    // Exchange code for token
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return Response.json({ error: "GitHub OAuth failed" }, { status: 401 });
    }

    // Get user info
    const userRes = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const ghUser = await userRes.json();

    // Get email
    let email = ghUser.email;
    if (!email) {
      const emailRes = await fetch("https://api.github.com/user/emails", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      const primary = emails.find((e: { primary: boolean }) => e.primary);
      email = primary?.email || emails[0]?.email;
    }

    // Find or create user
    let user = await getUserByProvider("github", String(ghUser.id));
    if (!user && email) {
      user = await getUserByEmail(email);
    }
    if (!user) {
      user = await createUser({
        email,
        name: ghUser.name || ghUser.login,
        provider: "github",
        providerId: String(ghUser.id),
        avatarUrl: ghUser.avatar_url,
      });
    }

    const token = await createToken(user.id);
    return Response.json({ token, user: safeUser(user) });
  } catch (err) {
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
