import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DEL PUEBLO — Dashboard',
  description: 'Ventas y cierres de la caja DEL PUEBLO',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
