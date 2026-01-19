import { AuthProvider } from "@/components/context/AuthProvider.js";
import { PermissionsProvider } from "@/components/context/PermissionsProvider.js";
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
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${poppinsFont.className} antialiased`}>
        <AuthProvider>
          <PermissionsProvider>
            {children}
          </PermissionsProvider>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
