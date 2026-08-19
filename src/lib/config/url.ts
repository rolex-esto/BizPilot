/**
 * BizPilot Application URL Utility & Environment Safety Guard
 * 
 * Enforces strict environment separation:
 * - Development: Allows localhost or configured NEXT_PUBLIC_APP_URL.
 * - Production: STRICT REQUIREMENT — NEXT_PUBLIC_APP_URL must be configured,
 *   must use HTTPS protocol, and must NOT point to localhost or 127.0.0.1.
 */

export function getAppUrl(path: string = ""): string {
  const isProduction = process.env.NODE_ENV === "production";
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  let baseUrl: string;

  if (isProduction) {
    if (!configuredUrl) {
      throw new Error(
        "[URL Safety Error] NEXT_PUBLIC_APP_URL is not configured. In production, a valid HTTPS application URL is required to generate email links."
      );
    }

    try {
      const parsed = new URL(configuredUrl);
      if (parsed.protocol !== "https:") {
        throw new Error(
          `[URL Safety Error] In production, NEXT_PUBLIC_APP_URL must use HTTPS protocol. Found: "${parsed.protocol}"`
        );
      }
      if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1" || parsed.hostname === "::1") {
        throw new Error(
          `[URL Safety Error] In production, NEXT_PUBLIC_APP_URL cannot point to localhost/127.0.0.1. Found: "${parsed.hostname}"`
        );
      }
      baseUrl = configuredUrl.replace(/\/+$/, "");
    } catch (err: any) {
      if (err.message.includes("[URL Safety Error]")) {
        throw err;
      }
      throw new Error(
        `[URL Safety Error] Invalid NEXT_PUBLIC_APP_URL configured: "${configuredUrl}". ${err.message}`
      );
    }
  } else {
    // Development / Test mode
    baseUrl = (configuredUrl || "http://localhost:3000").replace(/\/+$/, "");
  }

  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return cleanPath ? `${baseUrl}${cleanPath}` : baseUrl;
}
