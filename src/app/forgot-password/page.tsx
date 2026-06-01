'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ShieldCheck, Mail, Lock, Key, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [foundCandidate, setFoundCandidate] = useState<any | null>(null);

  const handleLookupEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
        const candidate = existingCandidates.find(
          (c: any) => c.email?.toLowerCase() === email.toLowerCase()
        );

        if (candidate) {
          setFoundCandidate(candidate);
          setInfoMessage(`Account found for ${candidate.fullName || candidate.full_name}! Enter your new password below.`);
        } else {
          setFoundCandidate(null);
          setInfoMessage('No local profile found. We will automatically create a fully approved candidate profile with this email when you set your password!');
        }
        setStep(2);
      } catch (err) {
        setError('An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 800);
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    setTimeout(() => {
      try {
        const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');

        if (foundCandidate) {
          // Update password for existing candidate
          const updatedCandidates = existingCandidates.map((c: any) => {
            if (c.email?.toLowerCase() === email.toLowerCase()) {
              return { ...c, password: newPassword };
            }
            return c;
          });
          localStorage.setItem('allCandidates', JSON.stringify(updatedCandidates));

          // Also update currentUser in case they are logged in
          const currentUserStr = localStorage.getItem('currentUser');
          if (currentUserStr) {
            const currentUser = JSON.parse(currentUserStr);
            if (currentUser.email?.toLowerCase() === email.toLowerCase()) {
              localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, password: newPassword }));
            }
          }
        } else {
          // Create a new candidate on-the-fly to ensure they can proceed to test
          const apxCandidates = existingCandidates.filter((c: any) => typeof c.id === 'string' && /^APX-\d+$/.test(c.id));
          let nextIdNum = 1000;
          if (apxCandidates.length > 0) {
            const maxId = Math.max(...apxCandidates.map((c: any) => parseInt(c.id.split('-')[1], 10)));
            nextIdNum = maxId + 1;
          }
          const nextApxId = `APX-${nextIdNum}`;

          const namePrefix = email.split('@')[0];
          const newCandidate = {
            id: nextApxId,
            candidateId: nextApxId,
            registrationId: nextApxId,
            fullName: namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1),
            full_name: namePrefix.charAt(0).toUpperCase() + namePrefix.slice(1),
            email: email.toLowerCase(),
            password: newPassword,
            mobile: '+91 98765 43210',
            idType: 'Aadhar Card',
            id_proof_type: 'Aadhar Card',
            idNumber: '1234 5678 9012',
            id_proof_number: '1234 5678 9012',
            city: 'Mumbai',
            state: 'Maharashtra',
            examType: 'General Aptitude',
            role: 'candidate',
            status: 'Approved',
            exam_slot: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString()
          };
          existingCandidates.push(newCandidate);
          localStorage.setItem('allCandidates', JSON.stringify(existingCandidates));
        }

        setStep(3);
      } catch (err) {
        setError('Failed to update password. Please try again.');
      } finally {
        setLoading(false);
      }
    }, 1000);
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        {step < 3 && (
          <div className={styles.header}>
            <div className={styles.logoIcon}>
              <Key size={32} color="white" />
            </div>
            <h1 className={styles.title}>Reset Password</h1>
            <p className={styles.subtitle}>
              {step === 1 ? 'Enter your email to verify your candidate profile' : 'Choose a strong new password for your account'}
            </p>
          </div>
        )}

        {error && <div className={styles.errorBanner}>{error}</div>}
        {infoMessage && <div className={styles.infoBanner}>{infoMessage}</div>}

        {step === 1 && (
          <form className={styles.form} onSubmit={handleLookupEmail}>
            <Input
              label="Registered Email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Button type="submit" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Searching Profile...' : 'Verify Candidate'} <ArrowRight size={18} style={{ marginLeft: '8px' }} />
            </Button>

            <Link href="/login" className={styles.backToLogin}>
              <ArrowLeft size={16} /> Back to Login
            </Link>
          </form>
        )}

        {step === 2 && (
          <form className={styles.form} onSubmit={handleResetPassword}>
            <Input
              label="New Password"
              type="password"
              placeholder="••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <div className={styles.actionRow}>
              <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button type="submit" style={{ flex: 1 }} disabled={loading}>
                {loading ? 'Updating...' : 'Save Password'}
              </Button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div className={styles.successWrapper}>
            <div className={styles.successIcon}>
              <CheckCircle2 size={64} color="white" />
            </div>
            <h1 className={styles.successTitle}>Password Updated!</h1>
            <p className={styles.successSubtitle}>
              Your password has been successfully configured. You can now log in to the assessment portal.
            </p>
            
            <div style={{ marginTop: '30px', width: '100%' }}>
              <Link href="/login">
                <Button style={{ width: '100%' }}>
                  Proceed to Login
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
