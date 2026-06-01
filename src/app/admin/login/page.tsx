'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldAlert, LogIn, Lock, Eye, EyeOff } from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminLoginPage() {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const [isResetting, setIsResetting] = useState(false);
  const [newPassword, setNewPassword] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentAdminId = localStorage.getItem('adminUsername') || 'admin';
    const currentAdminPass = localStorage.getItem('adminPassword') || 'Apexium@123';
    
    if (adminId === currentAdminId && password === currentAdminPass) {
      localStorage.setItem('adminAuth', 'true');
      localStorage.setItem('currentUser', JSON.stringify({
        role: "admin",
        adminId: currentAdminId
      }));
      router.push('/admin/dashboard');
    } else {
      setError('Invalid Admin ID or Password');
    }
  };

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    const currentAdminId = localStorage.getItem('adminUsername') || 'admin';
    
    if (adminId === currentAdminId) {
      if (newPassword.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      localStorage.setItem('adminPassword', newPassword);
      setError('');
      setIsResetting(false);
      setPassword('');
      setNewPassword('');
      alert("Password successfully reset! Please login with your new password.");
    } else {
      setError('Invalid Admin ID for recovery');
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <ShieldAlert size={32} color="white" />
          </div>
          <h1 className={styles.title}>{isResetting ? "Reset Admin Password" : "Admin Portal Access"}</h1>
          <p className={styles.subtitle}>
            {isResetting ? "Enter your Admin ID and a new secure password" : "Secure login for authorized personnel only"}
          </p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        {!isResetting ? (
          <form className={styles.form} onSubmit={handleLogin}>
            <div className={styles.inputGroup}>
              <Input 
                label="Admin ID" 
                type="text" 
                placeholder="admin"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup} style={{ position: 'relative' }}>
              <Input 
                label="Secure Password" 
                type={showPassword ? "text" : "password"} 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '36px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            <div className={styles.options}>
              <button 
                type="button" 
                onClick={() => { setIsResetting(true); setError(''); }} 
                className={styles.forgot}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Change Password
              </button>
            </div>

            <Button type="submit" style={{ width: '100%', backgroundColor: '#008F8C', border: 'none' }}>
              <LogIn size={18} style={{ marginRight: '8px' }} /> Access Dashboard
            </Button>
          </form>
        ) : (
          <form className={styles.form} onSubmit={handleReset}>
            <div className={styles.inputGroup}>
              <Input 
                label="Admin ID" 
                type="text" 
                placeholder="admin"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup} style={{ position: 'relative' }}>
              <Input 
                label="New Password" 
                type={showPassword ? "text" : "password"} 
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <button 
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '36px',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px'
                }}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className={styles.options}>
              <button 
                type="button" 
                onClick={() => { setIsResetting(false); setError(''); }} 
                className={styles.forgot}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                Back to Login
              </button>
            </div>

            <Button type="submit" style={{ width: '100%', backgroundColor: '#f59e0b', border: 'none' }}>
              <Lock size={18} style={{ marginRight: '8px' }} /> Update Password
            </Button>
          </form>
        )}
        
        <div className={styles.warningText}>
          <Lock size={12} style={{ marginRight: '4px' }} />
          Unauthorized access is strictly prohibited and logged.
        </div>
      </div>
    </main>
  );
}
