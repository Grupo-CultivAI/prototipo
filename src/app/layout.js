import "../styles/globals.css";
import { SCRIPT_DO_TEMA } from "@/lib/tema";


import { Poppins, Roboto } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-title"
});

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-text"
});

export const metadata = {
  title: "CultivAI",
  description: "IA para auxílio agrícola"
};

export default function RootLayout({ children }) {
  return (
    // suppressHydrationWarning: o script abaixo põe data-tema no <html> antes do React carregar
    <html lang="pt-br" suppressHydrationWarning>
      <head>
        {/* Tema escuro antes da primeira pintura, sem piscar o claro (src/lib/tema.js) */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_DO_TEMA }} />
      </head>
      <body className={`${poppins.variable} ${roboto.variable}`} suppressHydrationWarning>

        {children}

      </body>
    </html>
  );
}