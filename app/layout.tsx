import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Toaster } from 'sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Reembolsa — IVA Exportador Recovery',
  description: 'Recover your Export VAT (IVA Exportador) faster with Reembolsa.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <TooltipProvider delayDuration={300}>
          <div className="min-h-screen bg-slate-50">
            <div className="flex">
              <Sidebar />
              <div className="flex-1 lg:pl-64">
                <Topbar />
                <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
              </div>
            </div>
          </div>
        </TooltipProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
