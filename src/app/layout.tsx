import "~/styles/globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });
import { type Metadata } from "next";
import { WalletProvider } from "~/components/providers";
import { Header } from "~/components/Header";
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
    <html lang="en" className={`${inter.className} no-scrollbar-x`}>
      <body className="no-scrollbar-x bg-black">
        <WalletProvider>
          <Header />
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
