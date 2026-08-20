import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBusinessAuth } from "@/lib/auth/api-guard";
import { TokenVault } from "@/lib/connectors/token-vault";

export const dynamic = "force-dynamic";

/**
 * ALLOWED UPSTREAM MEDIA HOSTS (SSRF Prevention)
 */
const ALLOWED_HOST_SUFFIXES = [
  "fbcdn.net",
  "fbsbx.com",
  "facebook.com",
  "whatsapp.net",
  "tiktokcdn.com",
  "tiktokv.com",
  "byteoversea.com",
];

function isAllowedHost(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") return false;

    const hostname = parsed.hostname.toLowerCase();

    // Block private/internal networks
    if (
      hostname === "localhost" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^169\.254\./.test(hostname) ||
      hostname === "::1"
    ) {
      return false;
    }

    return ALLOWED_HOST_SUFFIXES.some(
      (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

/**
 * GET /api/media/proxy
 * 
 * Secure Media Proxy:
 * 1. Authenticates store owner & enforces strict tenant isolation.
 * 2. Resolves token-protected media (WhatsApp media IDs, Meta Graph API media).
 * 3. Prevents SSRF, IDOR, and token leakage to frontend.
 */
export async function GET(req: NextRequest) {
  try {
    const { user, businessId, errorResponse } = await requireBusinessAuth(req);
    if (errorResponse) return errorResponse;

    const searchParams = req.nextUrl.searchParams;
    const messageId = searchParams.get("messageId");
    const directMediaUrl = searchParams.get("mediaUrl");
    const platform = searchParams.get("platform");
    const mediaId = searchParams.get("mediaId");

    let targetUrl: string | null = null;
    let authHeader: string | null = null;

    if (messageId) {
      // 1. Message-Scoped Resolution (Most Secure)
      const message = await prisma.message.findUnique({
        where: { id: messageId },
        include: { conversation: true },
      });

      if (!message || (user?.role !== "ADMIN" && message.conversation.businessId !== businessId)) {
        return NextResponse.json({ error: "Media not found or unauthorized" }, { status: 404 });
      }

      if (!message.mediaUrl) {
        return NextResponse.json({ error: "No media attachment for this message" }, { status: 404 });
      }

      targetUrl = message.mediaUrl;
    } else if (platform === "WHATSAPP" && mediaId) {
      if (!businessId) {
        return NextResponse.json({ error: "Unauthorized store context." }, { status: 401 });
      }

      // 2. WhatsApp Token-Protected Media ID Resolution
      const conn = await prisma.platformConnection.findFirst({
        where: {
          businessId,
          platform: "WHATSAPP",
          status: "CONNECTED",
        },
      });

      if (!conn || !conn.accessTokenEncrypted) {
        return NextResponse.json({ error: "Active WhatsApp connection required to download media" }, { status: 403 });
      }

      const rawToken = TokenVault.decrypt(conn.accessTokenEncrypted);
      if (!rawToken) {
        return NextResponse.json({ error: "Failed to decrypt WhatsApp access credentials" }, { status: 500 });
      }

      // Step A: Retrieve download URL from WhatsApp Cloud API
      const metaVersion = process.env.META_GRAPH_API_VERSION || "v19.0";
      const metaBaseUrl = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
      const infoUrl = `${metaBaseUrl}/${metaVersion}/${encodeURIComponent(mediaId)}`;

      const infoRes = await fetch(infoUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${rawToken}`,
          Accept: "application/json",
        },
      });

      if (!infoRes.ok) {
        const errData = await infoRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errData.error?.message || "Media is no longer available from WhatsApp platform" },
          { status: infoRes.status }
        );
      }

      const infoData = await infoRes.json();
      targetUrl = infoData.url;
      authHeader = `Bearer ${rawToken}`;
    } else if (directMediaUrl) {
      targetUrl = directMediaUrl;
    }

    if (!targetUrl) {
      return NextResponse.json({ error: "No media URL specified" }, { status: 400 });
    }

    // SSRF Check: Ensure upstream URL is an authorized social platform CDN
    if (!isAllowedHost(targetUrl)) {
      return NextResponse.json(
        { error: "Access to the requested media domain is restricted for security." },
        { status: 403 }
      );
    }

    // Stream upstream binary to client
    const headers: Record<string, string> = {
      "User-Agent": "BizPilot-Media-Proxy/1.0",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      headers,
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: "Media is no longer available from the platform." },
        { status: upstreamRes.status }
      );
    }

    const contentType = upstreamRes.headers.get("content-type") || "application/octet-stream";
    const contentLength = upstreamRes.headers.get("content-length");
    const bodyStream = upstreamRes.body;

    const responseHeaders: Record<string, string> = {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    };
    if (contentLength) {
      responseHeaders["Content-Length"] = contentLength;
    }

    return new NextResponse(bodyStream as any, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    console.error("Media proxy error:", error);
    return NextResponse.json({ error: "Failed to retrieve media from platform." }, { status: 500 });
  }
}
