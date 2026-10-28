import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { cn } from "@/ui/cn";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Operations",
  description: "Portfolio performance dashboard with a streaming assistant",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased",
        GeistSans.variable,
        GeistMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
