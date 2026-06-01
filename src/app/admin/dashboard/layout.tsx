'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  BarChart3, Users, Activity, ShieldAlert, 
  Award, LogOut, Menu, X, CalendarClock
} from 'lucide-react';

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const isAdminAuth = localStorage.getItem('adminAuth');
    if (isAdminAuth !== 'true') {
      router.push('/admin/login');
    }
  }, [router]);

  if (!mounted) return null;

  const navItems = [
    { name: 'Overview', path: '/admin/dashboard', icon: BarChart3 },
    { name: 'Live Exams', path: '/admin/dashboard/live-exams', icon: Activity },
    { name: 'Registrations', path: '/admin/dashboard/registrations', icon: Users },
    { name: 'Scores & Results', path: '/admin/dashboard/scores', icon: Award },
    { name: 'Violations', path: '/admin/dashboard/violations', icon: ShieldAlert },
    { name: 'Reschedules', path: '/admin/dashboard/reschedules', icon: CalendarClock },
  ];

  const handleLogout = () => {
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('currentUser');
    router.push('/admin/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#f8fafc' }}>
      {/* Sidebar */}
      <aside 
        style={{ 
          width: '260px', 
          backgroundColor: '#0A3557', 
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          zIndex: 50,
          transition: 'transform 0.3s ease-in-out',
          transform: isMobileMenuOpen ? 'translateX(0)' : 'translateX(0)',
        }}
        className="sidebar-desktop"
      >
        <div style={{ padding: '24px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ backgroundColor: '#008F8C', padding: '8px', borderRadius: '8px' }}>
              <ShieldAlert size={24} color="white" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'white' }}>Admin Portal</h2>
          </div>
        </div>

        <nav style={{ padding: '20px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {navItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: isActive ? 'rgba(0, 143, 140, 0.2)' : 'transparent',
                  color: isActive ? '#008F8C' : '#94a3b8',
                  textDecoration: 'none',
                  fontWeight: isActive ? 600 : 500,
                  transition: 'all 0.2s'
                }}
              >
                <item.icon size={20} color={isActive ? '#008F8C' : '#94a3b8'} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              width: '100%',
              backgroundColor: 'transparent',
              color: '#ef4444',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
              borderRadius: '8px',
              textAlign: 'left'
            }}
          >
            <LogOut size={20} />
            Secure Logout
          </button>
        </div>
      </aside>

      {/* Mobile toggle button (hidden on desktop, but keeping simple for now) */}
      <div style={{ display: 'none' }} className="mobile-toggle">
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          <Menu size={24} />
        </button>
      </div>

      {/* Main Content Area */}
      <main style={{ flex: 1, marginLeft: '260px', width: 'calc(100% - 260px)', minHeight: '100vh', overflowX: 'hidden' }}>
        {children}
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        @media (max-width: 768px) {
          .sidebar-desktop {
            transform: translateX(-100%) !important;
          }
          main {
            marginLeft: 0 !important;
            width: 100% !important;
          }
          .mobile-toggle {
            display: block !important;
            position: fixed;
            top: 1rem;
            left: 1rem;
            z-index: 60;
          }
        }
      `}} />
    </div>
  );
}
