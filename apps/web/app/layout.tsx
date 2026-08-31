import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Consórcio Livre",
  description: "Marketplace de cartas de consórcio entre usuários verificados",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
