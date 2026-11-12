import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  axes: ["wdth"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rillet",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col isolate">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
