import { NextRequest, NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth/api-guard";

const MAX_IMAGE_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_DOC_BYTES = 25 * 1024 * 1024;   // 25MB

const ALLOWED_MIME_TYPES: Record<string, "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT"> = {
  // Images
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  // Videos
  "video/mp4": "VIDEO",
  "video/webm": "VIDEO",
  "video/quicktime": "VIDEO",
  // Audio
  "audio/mpeg": "AUDIO",
  "audio/ogg": "AUDIO",
  "audio/mp4": "AUDIO",
  "audio/aac": "AUDIO",
  "audio/wav": "AUDIO",
  // Documents
  "application/pdf": "DOCUMENT",
  "application/msword": "DOCUMENT",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCUMENT",
  "text/plain": "DOCUMENT",
};

/**
 * Validates magic bytes / file signatures for uploaded binary buffers
 */
function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 4) return false;

  // JPEG: FF D8 FF
  if (mimeType === "image/jpeg" && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true;
  // PNG: 89 50 4E 47
  if (mimeType === "image/png" && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return true;
  // GIF: GIF8
  if (mimeType === "image/gif" && buffer.toString("ascii", 0, 4) === "GIF8") return true;
  // WEBP: RIFF....WEBP
  if (mimeType === "image/webp" && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return true;
  // PDF: %PDF
  if (mimeType === "application/pdf" && buffer.toString("ascii", 0, 4) === "%PDF") return true;
  // MP4 / MOV: ....ftyp
  if ((mimeType === "video/mp4" || mimeType === "video/quicktime" || mimeType === "audio/mp4") && buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") return true;
  // WebM / OGG: EBML or OggS
  if (mimeType === "video/webm" && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;
  if (mimeType === "audio/ogg" && buffer.toString("ascii", 0, 4) === "OggS") return true;
  // MP3: ID3 or FF FB
  if (mimeType === "audio/mpeg" && (buffer.toString("ascii", 0, 3) === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) return true;
  // WAV: RIFF....WAVE
  if (mimeType === "audio/wav" && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") return true;
  // Text / Docs
  if (mimeType === "text/plain" || mimeType.includes("word")) return true;

  return false;
}

/**
 * POST /api/upload
 * 
 * Secure Multi-Type Media Upload:
 * Validates authentication, mime type, size, and file magic bytes.
 */
export async function POST(req: NextRequest) {
  try {
    const { user, errorResponse } = await requireAuth(req);
    if (errorResponse) return errorResponse;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Please select a file to upload." },
        { status: 400 }
      );
    }

    const mediaType = ALLOWED_MIME_TYPES[file.type];
    if (!mediaType) {
      return NextResponse.json(
        { error: "Unsupported file format. Please upload an image, video, audio, or PDF document." },
        { status: 400 }
      );
    }

    // Size limit enforcement
    const maxBytes = (mediaType === "IMAGE" || mediaType === "AUDIO") ? MAX_IMAGE_AUDIO_BYTES : MAX_VIDEO_DOC_BYTES;
    if (file.size > maxBytes) {
      const maxMb = maxBytes / (1024 * 1024);
      return NextResponse.json(
        { error: `File size exceeds the ${maxMb}MB limit for ${mediaType.toLowerCase()}s.` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Magic bytes validation
    const isValidSignature = validateMagicBytes(buffer, file.type);
    if (!isValidSignature) {
      return NextResponse.json(
        { error: "Corrupted or invalid file header signature." },
        { status: 400 }
      );
    }

    // Sanitize extension
    const originalName = file.name || "upload";
    const rawExt = path.extname(originalName).replace(".", "").toLowerCase();
    const safeExt = rawExt || (mediaType === "IMAGE" ? "jpg" : mediaType === "VIDEO" ? "mp4" : mediaType === "AUDIO" ? "mp3" : "pdf");
    const filename = `${mediaType.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${safeExt}`;

    let url: string;
    if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
      // Optimized Data URI for serverless cloud deployment
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

    return NextResponse.json({
      status: "success",
      url,
      mediaType,
      mimeType: file.type,
      filename: originalName,
      sizeBytes: file.size,
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "File upload failed. Please try again." },
      { status: 500 }
    );
  }
}
