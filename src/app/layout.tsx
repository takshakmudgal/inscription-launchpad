import "~/styles/globals.css";

import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
import { type Metadata } from "next";
import { WalletProvider } from "~/components/providers";
import "~/server/init";

export const metadata: Metadata = {
  title: "BitPill - Bitcoin Meme Launchpad",
  description:
    "The first Bitcoin meme coin launchpad. Vote for your favorites and watch them get permanently inscribed on the Bitcoin blockchain.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
