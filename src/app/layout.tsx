import React from 'react';
import type { Metadata, Viewport } from 'next';
import '../styles/tailwind.css';
import { AuthProvider } from '@/contexts/AuthContext';
import SWRProvider from '@/components/SWRProvider';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'PerfManage — ECSA-HC Performance Management System',
  description:
    'Centralized digital platform for tracking staff KPIs, managing performance reviews, and reporting against HEPRR-MPA and JEE/SPAR frameworks.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <SWRProvider>
            <ReferenceDataProvider>
              {children}
            </ReferenceDataProvider>
          </SWRProvider>
        </AuthProvider>

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fperfmanage6773back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></body>
    </html>
  );
}