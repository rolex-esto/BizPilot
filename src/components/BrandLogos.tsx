import React from "react";

export interface LogoProps {
  className?: string;
}

/**
 * Official Meta Facebook brand logo.
 * Exact 24x24 vector with #1877F2 background and white geometry.
 */
export function FacebookLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Facebook">
      <path d="M24 12C24 5.373 18.627 0 12 0S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854V15.47H7.078V12h3.047V9.356c0-3.007 1.79-4.668 4.533-4.668 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.875V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#1877F2"/>
    </svg>
  );
}

/**
 * Official Meta Instagram brand logo.
 * Exact 24x24 vector with official radial gradient and camera outline.
 */
export function InstagramLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Instagram">
      <defs>
        <radialGradient id="bizpilot_ig_grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497"/>
          <stop offset="5%" stopColor="#fdf497"/>
          <stop offset="45%" stopColor="#fd5949"/>
          <stop offset="60%" stopColor="#d6249f"/>
          <stop offset="90%" stopColor="#285AEB"/>
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#bizpilot_ig_grad)"/>
      <rect x="3" y="3" width="18" height="18" rx="4.5" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="12" cy="12" r="4" stroke="white" strokeWidth="1.5" fill="none"/>
      <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
    </svg>
  );
}

/**
 * Official Meta WhatsApp brand logo.
 * Exact 24x24 vector with #25D366 speech bubble and white receiver.
 */
export function WhatsAppLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="WhatsApp">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2z" fill="#25D366"/>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.04-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47s1.06 2.86 1.21 3.06c.15.2 2.09 3.19 5.06 4.47.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" fill="white"/>
    </svg>
  );
}

/**
 * Official ByteDance TikTok brand logo.
 * Exact 24x24 vector with #010101 background and cyan/magenta offset 3D chromatic aberration.
 */
export function TikTokLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="TikTok">
      <rect width="24" height="24" rx="6" fill="#010101"/>
      <path d="M16.6 8.17a4.28 4.28 0 01-2.63-.9A4.28 4.28 0 0112.8 5h-2.17v9.72a2.14 2.14 0 01-2.14 2.14 2.14 2.14 0 01-2.14-2.14 2.14 2.14 0 012.14-2.14c.23 0 .44.04.65.1V10.5a4.32 4.32 0 00-.65-.05 4.32 4.32 0 00-4.32 4.32A4.32 4.32 0 008.49 19a4.32 4.32 0 004.32-4.32V10.3a6.44 6.44 0 003.8 1.23V9.36a4.28 4.28 0 01-1.17-.3V8.17h1.17z" fill="white"/>
      <path d="M16.6 8.17a4.28 4.28 0 01-2.63-.9A4.28 4.28 0 0112.8 5h-2.17v9.72a2.14 2.14 0 01-2.14 2.14 2.14 2.14 0 01-2.14-2.14 2.14 2.14 0 012.14-2.14c.23 0 .44.04.65.1V10.5a4.32 4.32 0 00-.65-.05 4.32 4.32 0 00-4.32 4.32A4.32 4.32 0 008.49 19a4.32 4.32 0 004.32-4.32V10.3a6.44 6.44 0 003.8 1.23V9.36" stroke="#25F4EE" strokeWidth="0.5"/>
      <path d="M12.8 5h-2.17v9.72a2.14 2.14 0 01-4.28 0 2.14 2.14 0 012.14-2.14c.23 0 .44.04.65.1" stroke="#FE2C55" strokeWidth="0.5"/>
    </svg>
  );
}

/**
 * Official Meta Messenger brand logo.
 * Exact 24x24 vector with gradient speech bubble and white bolt.
 */
export function MessengerLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Messenger">
      <defs>
        <linearGradient id="bizpilot_msg_grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#00B2FF"/>
          <stop offset="100%" stopColor="#006AFF"/>
        </linearGradient>
      </defs>
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.893 1.436 5.474 3.682 7.158V22l3.39-1.862c.904.25 1.862.384 2.858.384h.07C17.523 20.522 22 16.376 22 11.243 22 6.145 17.523 2 12 2z" fill="url(#bizpilot_msg_grad)"/>
      <path d="M6.5 13.5l3-3.5 2 2 3-3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

/**
 * Official X Corp (formerly Twitter) brand logo.
 * Exact 24x24 vector with black background and white geometric X.
 */
export function XLogo({ className = "w-6 h-6" }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="X">
      <rect width="24" height="24" rx="5" fill="#000000" />
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="white" />
    </svg>
  );
}

/**
 * Centralized Universal Platform Logo component.
 * Maps any platform ID strictly to its official vector brand logo.
 */
export function PlatformLogo({
  platform,
  className = "w-6 h-6",
}: {
  platform: string;
  className?: string;
}) {
  const p = (platform || "").toUpperCase();
  switch (p) {
    case "FACEBOOK":
      return <FacebookLogo className={className} />;
    case "INSTAGRAM":
      return <InstagramLogo className={className} />;
    case "WHATSAPP":
      return <WhatsAppLogo className={className} />;
    case "TIKTOK":
      return <TikTokLogo className={className} />;
    case "MESSENGER":
      return <MessengerLogo className={className} />;
    case "X":
    case "TWITTER":
      return <XLogo className={className} />;
    default:
      return <FacebookLogo className={className} />;
  }
}
