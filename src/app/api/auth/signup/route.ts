import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import crypto from "crypto";
import { getVerificationUrl, sendVerificationEmail } from "@/lib/auth/verification";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, storeName, contactNumber, address } = body;

    // ─── Input Validation ───
    if (!name?.trim() || !email?.trim() || !password || !storeName?.trim()) {
      return NextResponse.json(
        { error: "Please fill in all required fields: your name, store name, email, and password." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // ─── Reserved Admin Email Protection ───
    const RESERVED_ADMIN_EMAILS = [
      "bizpilot.mailer@gmail.com",
      (process.env.ADMIN_EMAIL || "").toLowerCase().trim(),
      (process.env.BIZPILOT_ADMIN_EMAIL || "").toLowerCase().trim(),
    ].filter(Boolean);

    if (RESERVED_ADMIN_EMAILS.includes(cleanEmail)) {
      return NextResponse.json(
        { error: "This email address cannot be registered. Please use another email or contact support." },
        { status: 400 }
      );
    }

    // ─── Check if a verified account already exists ───
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists. Please sign in instead." },
        { status: 409 }
      );
    }

    // ─── Create or replace pending signup (atomic, retry-safe) ───
    // upsert ensures:
    // - First attempt: creates PendingSignup
    // - Retry with same email: overwrites with fresh data + new token
    // - No "email locked" scenario ever occurs for pending signups
    const passwordHash = hashPassword(password);
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.pendingSignup.upsert({
      where: { email: cleanEmail },
      update: {
        passwordHash,
        name: name.trim(),
        storeName: storeName.trim(),
        contactNumber: contactNumber?.trim() || null,
        address: address?.trim() || null,
        verificationToken,
        expiresAt,
      },
      create: {
        email: cleanEmail,
        passwordHash,
        name: name.trim(),
        storeName: storeName.trim(),
        contactNumber: contactNumber?.trim() || null,
        address: address?.trim() || null,
        verificationToken,
        expiresAt,
      },
    });

    // ─── Send verification email (external side effect, after DB commit) ───
    const verificationUrl = getVerificationUrl(verificationToken);
    let emailSent = false;
    try {
      emailSent = await sendVerificationEmail(cleanEmail, name.trim(), verificationUrl);
    } catch (emailError) {
      console.error("Verification email send failed:", emailError);
      // PendingSignup is saved — user can use "resend" later
    }

    if (emailSent) {
      return NextResponse.json({
        status: "success",
        message: "Please check your email and click the verification link to activate your account.",
        requiresVerification: true,
      });
    } else {
      // Account data saved, but email couldn't be sent
      return NextResponse.json({
        status: "success",
        message: "Your account was created, but we couldn't send the verification email. Please try sending the verification email again.",
        requiresVerification: true,
        emailFailed: true,
      });
    }
  } catch (error: any) {
    console.error("Signup error:", error);
    // If we reach here, the DB operation itself failed — nothing was saved
    return NextResponse.json(
      { error: "We couldn't create your account right now. Nothing was saved, so you can try again." },
      { status: 500 }
    );
  }
}
