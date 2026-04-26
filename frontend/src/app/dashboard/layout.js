'use client';

import { useAuth } from '../../components/AuthProvider';
import DashboardSidebar from '../../components/DashboardSidebar';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="dash-loading">
        <div className="loading-orb" />
        <div className="loading-text">Chargement du dashboard...</div>
      </div>
    );
  }

  return (
    <div className="dash-layout" id="dashboard-layout">
      <DashboardSidebar />
      <main className="dash-main">
        {children}
      </main>
    </div>
  );
}
