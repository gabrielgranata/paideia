import type { Metadata } from "next";
import { DM_Serif_Display, EB_Garamond, Syne } from "next/font/google";
import "./globals.css";

const dmSerifDisplay = DM_Serif_Display({
  variable: "--font-display",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const ebGaramond = EB_Garamond({
  variable: "--font-body",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-ui",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Paideia",
  description: "A learning platform for the activity of reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${ebGaramond.variable} ${syne.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" style={{ background: "#F4F0E8", color: "#1A1610", fontFamily: "var(--font-body), Georgia, serif" }}>{children}</body>
    </html>
  );
}
