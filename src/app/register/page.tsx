'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Progress } from '@/components/ui/Progress';
import styles from './page.module.css';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

const STEPS = [
  'Personal Details',
  'ID & Location',
  'Security'
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedId, setGeneratedId] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    mobile: '',
    email: '',
    idType: 'Aadhar Card',
    idNumber: '',
    city: '',
    state: '',
    examType: 'General Aptitude',
    examDate: '',
    examTime: '',
    password: '',
    otp: ''
  });

  const progress = (step / STEPS.length) * 100;

  const nextStep = () => {
    if (step === 1) {
      if (!formData.fullName || !formData.mobile || !formData.email) {
        alert("Please fill all the details");
        return;
      }
      const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const isAlreadyRegistered = existingCandidates.some((c: any) => c.email === formData.email || c.mobile === formData.mobile);
      if (isAlreadyRegistered) {
        alert("Already registered. Please login instead.");
        return;
      }
    }

    if (step === 2) {
      if (!formData.idType || !formData.idNumber || !formData.city || !formData.state) {
        alert("Please fill all the details");
        return;
      }
      if (error) {
        alert("Please provide a valid ID number.");
        return;
      }
    }

    if (step === 3) {
      if (!formData.password) {
        alert("Please create a password");
        return;
      }
    }

    setStep(s => Math.min(s + 1, STEPS.length));
  };
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <h2 style={{ color: 'var(--success)', marginBottom: '20px', fontSize: '1.8rem' }}>Registration Submitted</h2>
            <div style={{ padding: '15px', backgroundColor: '#e0f2fe', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bae6fd' }}>
              <p style={{ margin: 0, color: '#0369a1', fontWeight: 'bold' }}>Your Registration ID is: <span style={{ fontSize: '1.2em' }}>{generatedId || 'APX-XXX'}</span></p>
              <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', color: '#0284c7' }}>Please save this ID or use your email to log in.</p>
            </div>
            <p style={{ fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '30px', color: 'var(--text)' }}>
              Your application is currently under admin review. Once the admin approves your request, you will be allowed to write the exam. 
              Please wait while we verify your registration. We will contact you within 24 hours with the exam schedule and further instructions.
            </p>
            <Link href="/">
              <Button size="lg">Return to Home</Button>
            </Link>
          </div>
        ) : (
          <>
        <div className={styles.stepInfo}>
          <Progress value={progress} />
          <p className={styles.subtitle} style={{ marginTop: '10px', textAlign: 'center' }}>
            Step {step} of {STEPS.length}: {STEPS[step - 1]}
          </p>
        </div>

        <div className={styles.header}>
          <h1 className={styles.title}>Create Account</h1>
          <p className={styles.subtitle}>Join Aptitude Edge to start your journey</p>
        </div>

        <div className={styles.form}>
          {step === 1 && (
            <>
              <Input 
                label="Full Name" 
                name="fullName" 
                placeholder="John Doe" 
                value={formData.fullName}
                onChange={handleChange}
              />
              <Input 
                label="Mobile Number" 
                name="mobile" 
                placeholder="+91 98765 43210" 
                value={formData.mobile}
                onChange={handleChange}
              />
              <Input 
                label="Email Address" 
                name="email" 
                type="email" 
                placeholder="john@example.com" 
                value={formData.email}
                onChange={handleChange}
              />
            </>
          )}

          {step === 2 && (
            <>
              <div className={styles.formGroup}>
                <label className={styles.label}>ID Proof Type</label>
                <select 
                  name="idType" 
                  className={styles.select}
                  value={formData.idType}
                  onChange={handleChange as any}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border)',
                    backgroundColor: 'var(--bg-alt)',
                    fontFamily: 'inherit',
                    fontSize: '1rem',
                    marginBottom: '20px'
                  }}
                >
                  <option>Aadhar Card</option>
                  <option>PAN Card</option>
                  <option>Passport</option>
                </select>
              </div>
              <Input 
                label="ID Number" 
                name="idNumber" 
                placeholder={formData.idType === 'Aadhar Card' ? "1234 5678 9012" : "ABCDE1234F"} 
                value={formData.idNumber}
                onChange={(e) => {
                  const val = e.target.value;
                  if (formData.idType === 'Aadhar Card') {
                    if (val.length > 12) return;
                    if (val.length > 0 && val.length !== 12) {
                      setError('Invalid Aadhaar Number (Must be 12 digits)');
                    } else {
                      setError('');
                    }
                  }
                  handleChange(e as any);
                }}
              />
              {error && <p style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '-15px', marginBottom: '15px', fontWeight: 700 }}>{error}</p>}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <Input 
                  label="City" 
                  name="city" 
                  placeholder="City" 
                  value={formData.city}
                  onChange={handleChange}
                />
                <Input 
                  label="State" 
                  name="state" 
                  placeholder="State" 
                  value={formData.state}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className={styles.subtitle} style={{ marginBottom: '20px' }}>
                Create a secure password to protect your account.
              </p>
              <Input 
                label="Create Password" 
                name="password" 
                type="password" 
                placeholder="••••••••" 
                value={formData.password}
                onChange={handleChange}
              />
            </>
          )}

          {step < STEPS.length ? (
            <Button onClick={nextStep}>Continue</Button>
          ) : (
            <Button disabled={loading} onClick={async () => {
              if (!formData.password) {
                setError('Please create a password');
                return;
              }
              setLoading(true);
              setError('');
              try {
                  // 1. Sign up the user in auth.users
                  const existingCandidatesList = JSON.parse(localStorage.getItem('allCandidates') || '[]');
                  const apxCandidates = existingCandidatesList.filter((c: any) => typeof c.id === 'string' && /^APX-\d+$/.test(c.id));
                  let nextIdNum = 1000;
                  if (apxCandidates.length > 0) {
                    const maxId = Math.max(...apxCandidates.map((c: any) => parseInt(c.id.split('-')[1], 10)));
                    nextIdNum = maxId + 1;
                  }
                  const nextApxId = `APX-${nextIdNum}`;
                  let userId = nextApxId;
                  
                  try {
                    const { data: authData, error: authError } = await supabase.auth.signUp({
                      email: formData.email,
                      password: formData.password,
                      options: {
                        data: {
                          full_name: formData.fullName
                        }
                      }
                    });
                    console.log('authData:', authData)
console.log('authError:', authError)
                    if (authError) {
  alert(authError.message)
  console.error(authError)
  return
}
                    

                    if (authError) {
                      console.warn("Supabase Auth Error:", authError);
                    } else if (authData.user) {
                      // Note: We keep the UUID in Supabase database mapping for FK integrity,
                      // but in our candidate session and profiles we use nextApxId for UI tracking.
                      const { error: profileError } = await supabase.from('profiles').insert({
                        id: authData.user.id,
                        full_name: formData.fullName,
                        mobile: formData.mobile,
                        email: formData.email,
                        id_proof_type: formData.idType,
                        id_proof_number: formData.idNumber,
                        city: formData.city,
                        state: formData.state,
                        role: 'candidate',
                        status: 'Pending',
                        exam_slot: null,
                        created_at: new Date().toISOString()
                      });

                      if (profileError && !profileError.message.includes('row-level security')) {
                        console.error("Profile insert error:", profileError);
                      }
                    }
                  } catch (supabaseErr) {
                    console.error("Supabase network error (Likely paused or invalid URL):", supabaseErr);
                  }

                  // 3. Save session locally (Fallback for testing if Supabase fails)
                  const sessionUser = {
                    ...formData,
                    id: userId,
                    candidateId: userId,
                    registrationId: userId,
                    status: 'Pending',
                    role: 'candidate',
                    created_at: new Date().toISOString(),
                    full_name: formData.fullName,
                    id_proof_type: formData.idType,
                    id_proof_number: formData.idNumber,
                    exam_slot: null
                  };
                  
                  localStorage.setItem('currentUser', JSON.stringify(sessionUser));
                  
                  // Also store in allCandidates for Admin Dashboard
                  const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
                  existingCandidates.push(sessionUser);
                  localStorage.setItem('allCandidates', JSON.stringify(existingCandidates));
                  
                  setGeneratedId(userId);
                  setIsSuccess(true);
                } catch (err: any) {
                  setError(err.message || 'Registration failed');
                  setLoading(false);
                }
            }}>{loading ? 'Submitting...' : 'Register'}</Button>
          )}
        </div>
          </>
        )}
      </div>
    </main>
  );
}
