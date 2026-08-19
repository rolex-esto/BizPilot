import { NextRequest, NextResponse } from "next/server";
import { askGeminiCopilot } from "@/lib/ai/gemini-copilot";
import { requireAuth } from "@/lib/auth/api-guard";

export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;
    const authenticatedUser = user!;

    const body = await req.json();
    const { question } = body;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "Please enter a question." }, { status: 400 });
    }

    if (!authenticatedUser.businessId) {
      return NextResponse.json({ error: "No business linked to your account." }, { status: 400 });
    }

    const answer = await askGeminiCopilot(authenticatedUser.businessId, question.trim());

    return NextResponse.json({
      status: "success",
      answer,
    });
  } catch (error: any) {
    console.error("Copilot QA error:", error);
    return NextResponse.json(
      { error: "I couldn't process your question right now. Please try again." },
      { status: 500 }
    );
  }
}
