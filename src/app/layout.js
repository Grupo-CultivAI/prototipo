import "../styles/globals.css";


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
    <html lang="pt-br">
      <body className={`${poppins.variable} ${roboto.variable}`} suppressHydrationWarning>

        {children}

      </body>
    </html>
  );
}