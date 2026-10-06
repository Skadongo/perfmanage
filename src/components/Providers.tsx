'use client';

import React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import SWRProvider from '@/components/SWRProvider';
import { ReferenceDataProvider } from '@/contexts/ReferenceDataContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SWRProvider>
        <ReferenceDataProvider>
          {children}
        </ReferenceDataProvider>
      </SWRProvider>
    </AuthProvider>
  );
}
