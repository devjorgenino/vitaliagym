import { AuthProvider } from "@/components/context/AuthProvider.js";
import { PermissionsProvider } from "@/components/context/PermissionsProvider.js";
import { OfflineSyncManager } from "@/components/OfflineSyncManager.jsx";
import { Toaster } from "sonner";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppinsFont = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  metadataBase: new URL("https://vitaliagym.com"),
  title: {
    default: "VitaliaGym",
    template: "%s | VitaliaGym",
  },
  description:
    "Somos la energía vital en movimiento. Un lugar para entrenar de forma eficiente e inteligente",
  keywords: "VitaliaGym, Gym, Fitness, Entrenamiento, Venezuela",
  authors: [{ name: "Jorge Niño" }],
  creator: "Jorge Niño",
  publisher: "VitaliaGym",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "es_VE",
    url: "https://vitaliagym.com",
    siteName: "VitaliaGym",
    title: "VitaliaGym",
    description: "Somos la energía vital en movimiento. Un lugar para entrenar de forma eficiente e inteligente",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "VitaliaGym",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "VitaliaGym",
    description: "Somos la energía vital en movimiento",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#626D21" },
    { media: "(prefers-color-scheme: dark)", color: "#0E120D" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppinsFont.className} antialiased`}>
        <AuthProvider>
          <PermissionsProvider>
            {children}
            <OfflineSyncManager />
          </PermissionsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
