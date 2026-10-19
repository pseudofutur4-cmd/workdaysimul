import type { Metadata } from "next";
import Lab from "@/components/Lab";
import "./globals.css";
import "./reference-theme.css";
import "./academy.css";
import "./implementation.css";
export const metadata: Metadata = {
  title: "HCM Practice Lab",
  description: "Independent local HCM learning simulator with synthetic data",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Lab />
        {children}
      </body>
    </html>
  );
}
