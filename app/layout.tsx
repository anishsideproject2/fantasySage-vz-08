import type React from "react"
import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "FantasySage",
  description: "Fantasy Draft Assistant - Crush your Sleeper drafts with live data and multiple ranking sources",
  generator: "v0.dev",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='grad1' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' style='stop-color:%23667eea;stop-opacity:1' /><stop offset='100%25' style='stop-color:%23764ba2;stop-opacity:1' /></linearGradient></defs><circle cx='50' cy='50' r='45' fill='url(%23grad1)' stroke='%23ffffff' strokeWidth='2'/><text x='50' y='60' fontFamily='Arial, sans-serif' fontSize='36' fontWeight='bold' textAnchor='middle' fill='%23ffffff'>FS</text></svg>",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
