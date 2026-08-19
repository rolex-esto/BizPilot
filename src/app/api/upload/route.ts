import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth/api-guard";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

/**
 * POST /api/upload
 * 
 * Accepts a single image file (FormData with key "file").
 * Saves to /public/uploads/ and returns the public URL.
 * Validates file type, size, and requires authentication.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Please select an image to upload." },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Please upload a JPG, PNG, or WEBP image." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: `That photo is too large. Please choose an image under ${MAX_SIZE_MB}MB.` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const filename = `product-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let url: string;
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      // In serverless production without persistent local disk, persist as optimized Data URI
      const base64 = buffer.toString("base64");
      url = `data:${file.type};base64,${base64}`;
    } else {
      // Local development disk storage
      try {
        const uploadDir = path.join(process.cwd(), "public", "uploads");
        const filepath = path.join(uploadDir, filename);
        await writeFile(filepath, buffer);
        url = `/uploads/${filename}`;
      } catch {
        const base64 = buffer.toString("base64");
        url = `data:${file.type};base64,${base64}`;
      }
    }

    return NextResponse.json({ status: "success", url });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Your photo couldn't be uploaded. Please try again." },
      { status: 500 }
    );
  }
}
