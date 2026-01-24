import { AuthProvider } from "@/components/context/AuthProvider.js";
import { PermissionsProvider } from "@/components/context/PermissionsProvider.js";
import { OfflineSyncManager } from "@/components/OfflineSyncManager.jsx";
import { InstallPWA } from "@/components/ui/install-pwa.jsx";
import { Toaster } from "sonner";
import { Poppins } from "next/font/google";
import "./globals.css";

const poppinsFont = Poppins({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = {
  title: "VitaliaGym",
  description:
    "Somos la energía vital en movimiento. Un lugar para entrenar de forma eficiente e inteligente",
  keywords: "VitaliaGym, Gym, Fitness, Entrenamiento",
  author: "Jorge Niño",
  creator: "Jorge Niño",
  publisher: "Jorge Niño",
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppinsFont.className} antialiased`}>
        <AuthProvider>
          <PermissionsProvider>
            {children}
            <OfflineSyncManager />
            <InstallPWA />
          </PermissionsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
