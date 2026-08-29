// Where the actual product lives. The landing site is marketing-only — every
// "Get Started" CTA sends the visitor here, straight into sign-up.
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://conductor-labs.vercel.app";
export const SIGN_UP_URL = `${APP_URL}/sign-up`;
