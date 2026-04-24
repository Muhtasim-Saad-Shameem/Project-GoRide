import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
// import ChatPopup from "@/components/ChatPopup"; // Temporarily commented out due to merge conflicts

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "GoRide – Student Carpool Platform",
  description: "Share rides with fellow students, reduce transportation costs, and build a sustainable community.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* <ChatPopup /> Temporarily commented out due to merge conflicts */}
      </body>
    </html>
  );
}
