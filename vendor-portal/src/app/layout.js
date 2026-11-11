import '@/styles/dash.css';

export const metadata = {
  title: 'ServiPlus · Portal del proveedor',
  description: 'Gestión interna de restaurantes, licencias y versiones de ServiPlus',
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
