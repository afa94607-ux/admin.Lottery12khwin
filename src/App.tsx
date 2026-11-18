import React, { useState, useEffect } from 'react';
import { AdminLoginPage } from './components/AdminLoginPage';
import { EnterpriseAdminDashboard } from './components/EnterpriseAdminDashboard';
import { buildAuthHeaders, setAdminToken } from './utils/realtimeSync';
import { AdminAccount } from './types';

export default function App() {
  const [authenticatedAdmin, setAuthenticatedAdmin] = useState<AdminAccount | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const verifyAdminSession = async () => {
      try {
        const res = await fetch('/api/auth/admin/session', {
          headers: buildAuthHeaders(true),
          credentials: 'include',
        }).catch(() => null);

        if (mounted && res && res.ok) {
          const data = await res.json();
          if (data.authenticated && data.admin) {
            setAuthenticatedAdmin(data.admin);
          } else {
            setAdminToken(null);
          }
        } else if (mounted) {
          setAdminToken(null);
        }
      } finally {
        if (mounted) setAuthChecking(false);
      }
    };
    verifyAdminSession();
    return () => {
      mounted = false;
    };
  }, []);

  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#090d24] flex items-center justify-center text-amber-300 font-['Kantumruy_Pro',sans-serif]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-amber-400 border-t-transparent animate-spin" />
          <span className="text-sm font-bold">កំពុងផ្ទៀងផ្ទាត់ប្រព័ន្ធ... / Loading Lottery12KH Admin...</span>
        </div>
      </div>
    );
  }

  if (!authenticatedAdmin) {
    return (
      <AdminLoginPage
        onAdminLoginSuccess={(admin) => {
          setAuthenticatedAdmin(admin);
        }}
      />
    );
  }

  return (
    <EnterpriseAdminDashboard
      admin={authenticatedAdmin}
      onLogout={() => {
        setAuthenticatedAdmin(null);
      }}
    />
  );
}
