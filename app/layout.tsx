import { Roboto } from "next/font/google"; // Importujeme Roboto
import "./globals.css";

// Nastavení fontu
const roboto = Roboto({ 
  weight: ['300', '400', '500', '700', '900'], // Načteme různé tloušťky
  subsets: ["latin"],
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      {/* Aplikujeme třídu fontu na celé body */}
      <body className={roboto.className}>
        {children}
      </body>
    </html>
  );
}