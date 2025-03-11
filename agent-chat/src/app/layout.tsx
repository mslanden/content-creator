import type { Metadata } from "next";
import { AgentProvider } from "@/contexts/AgentContext";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentChat",
  description: "A ChatGPT-like chat application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-gray-900">
        <AgentProvider>
          <main className="min-h-screen w-screen transition-all duration-300">
            {children}
          </main>
        </AgentProvider>
      </body>
    </html>
  );
}