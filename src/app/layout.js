import "../styles/globals.css";
<<<<<<< HEAD

=======
import Navbar from "@/components/Navbar";
>>>>>>> 502531a59aafcdcc304b2ac35ac61910f039a2a3

import { Poppins, Roboto } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
<<<<<<< HEAD
  weight: ["400", "500", "600", "700"],
=======
  weight: ["400","500","600","700"],
>>>>>>> 502531a59aafcdcc304b2ac35ac61910f039a2a3
  variable: "--font-title"
});

const roboto = Roboto({
  subsets: ["latin"],
<<<<<<< HEAD
  weight: ["300", "400", "500"],
=======
  weight: ["300","400","500"],
>>>>>>> 502531a59aafcdcc304b2ac35ac61910f039a2a3
  variable: "--font-text"
});

export const metadata = {
  title: "CultivAI",
  description: "IA para auxílio agrícola"
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-br">
<<<<<<< HEAD
      <body className={`${poppins.variable} ${roboto.variable}`} suppressHydrationWarning>

        {children}
=======
      <body className={`${poppins.variable} ${roboto.variable}`}>

        <Navbar />

        <main>
          {children}
        </main>
>>>>>>> 502531a59aafcdcc304b2ac35ac61910f039a2a3

      </body>
    </html>
  );
}