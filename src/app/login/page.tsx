'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Shield, LogIn, User, Mail, Lock } from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);



  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 1. First check local candidates registry
      const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const localUser = existingCandidates.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
      
      if (localUser) {
        if (localUser.password === password) {
          // Success! Save session locally
          localStorage.setItem('currentUser', JSON.stringify(localUser));
          window.location.href = '/dashboard';
          return;
        } else {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }

      // 2. If not found locally, attempt real Supabase sign-in
      try {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (authData?.user) {
          // Fetch candidate profile from database
          const { data: profileData } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

          const sessionUser = {
            id: authData.user.id,
            fullName: profileData?.full_name || authData.user.user_metadata?.full_name || 'Candidate',
            full_name: profileData?.full_name || authData.user.user_metadata?.full_name || 'Candidate',
            email: email,
            mobile: profileData?.mobile || '',
            idType: profileData?.id_proof_type || 'Aadhar Card',
            id_proof_type: profileData?.id_proof_type || 'Aadhar Card',
            idNumber: profileData?.id_proof_number || '',
            id_proof_number: profileData?.id_proof_number || '',
            city: profileData?.city || '',
            state: profileData?.state || '',
            examType: profileData?.exam_type || 'General Aptitude',
            exam_slot: profileData?.exam_slot || null,
            role: profileData?.role || 'candidate',
            status: profileData?.status || 'Pending'
          };

          localStorage.setItem('currentUser', JSON.stringify(sessionUser));

          // Also save in allCandidates locally for consistency
          const updatedCandidates = [...existingCandidates];
          const exists = updatedCandidates.some((c: any) => c.id === sessionUser.id || c.email === email);
          if (!exists) {
            updatedCandidates.push(sessionUser);
            localStorage.setItem('allCandidates', JSON.stringify(updatedCandidates));
          }

          window.location.href = '/dashboard';
          return;
        } else if (authError) {
          console.warn("Supabase auth error during login:", authError.message);
        }
      } catch (supabaseErr) {
        console.error("Supabase auth skipped/failed:", supabaseErr);
      }

      // 3. User is not registered or credentials incorrect
      setError('User not found. Please register first.');
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.logoIcon}>
            <Shield size={32} color="white" />
          </div>
          <h1 className={styles.title}>Welcome Back</h1>
          <p className={styles.subtitle}>Log in to continue your examination</p>
        </div>

        {error && <div className={styles.errorBanner}>{error}</div>}

        <form className={styles.form} onSubmit={handleLogin}>
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <div className={styles.options}>
            <label className={styles.remember}>
              <input type="checkbox" /> Remember me
            </label>
            <Link href="/forgot-password" className={styles.forgot}>Forgot Password?</Link>
          </div>

          <Button type="submit" style={{ width: '100%' }} disabled={loading}>
            <LogIn size={18} style={{ marginRight: '8px' }} /> {loading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        <p className={styles.footer}>
          Don't have an account? <Link href="/register">Create one for free</Link>
        </p>
      </div>
    </main>
  );
}
