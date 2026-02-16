import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vector OS",
  description: "Personal productivity operating system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
