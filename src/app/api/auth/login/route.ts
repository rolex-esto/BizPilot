import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Please enter both your email address and password." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    // Check if there's a pending (unverified) signup for this email
    if (!user) {
      const pending = await prisma.pendingSignup.findUnique({
        where: { email: cleanEmail },
      });

      if (pending) {
        // Account exists but hasn't been verified yet
        return NextResponse.json(
          {
            error: "Please verify your email before logging in. Check your inbox for the verification link.",
            code: "EMAIL_NOT_VERIFIED",
            email: cleanEmail,
          },
          { status: 403 }
        );
      }

      // No user and no pending signup — wrong credentials
      return NextResponse.json(
        { error: "Your login details don't match. Please check your email and password and try again." },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "Your login details don't match. Please check your email and password and try again." },
        { status: 401 }
      );
    }

    // User exists and is verified (only verified users are in the User table)
    // Create session
    const { token, expiresAt } = await createSession(user.id);

    const response = NextResponse.json({
      status: "success",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        businessId: user.businessId,
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again in a moment." },
      { status: 500 }
    );
  }
}
