import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Conductor Labs",
  description: "Deployment readiness dashboard — know when you're safe to ship.",
  icons: {
    // The favicon follows the BROWSER's theme (tab bar background), not the
    // dashboard's own always-dark UI — hence swapping on prefers-color-scheme.
    icon: [
      { url: "/conductor-mark-dark.svg", media: "(prefers-color-scheme: light)" },
      { url: "/conductor-mark-light.svg", media: "(prefers-color-scheme: dark)" },
      { url: "/conductor-mark-dark.svg", type: "image/svg+xml" },
    ],
    apple: "/conductor-app-icon-dark-1024.png",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <ClerkProvider
      appearance={{
        theme: dark,
        variables: {
          colorPrimary: "#3ecf8e",
          colorBackground: "#0c110f",
          colorInput: "#161c19",
          colorForeground: "#eef2f0",
          borderRadius: "0.625rem",
          fontFamily: "var(--font-geist-sans)",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ClerkProvider>
  );
}
