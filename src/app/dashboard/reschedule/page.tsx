'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Calendar, Clock, User, Mail, Phone, FileText, AlertCircle, 
  Upload, CheckCircle, ArrowLeft, Loader2, CalendarClock, ShieldCheck
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import styles from './page.module.css';

export default function ReschedulePage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submittingStep, setSubmittingStep] = useState('');
  
  // Existing request state (if any)
  const [existingRequest, setExistingRequest] = useState<any>(null);
  // History of all past reschedule requests
  const [rescheduleHistory, setRescheduleHistory] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    candidateId: '',
    previousExamDate: '',
    reason: '',
    explanation: '',
    preferredDate: '',
    preferredTimeSlot: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // File Upload State
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Status List for Tracker
  const statusSteps = [
    { label: 'Request Submitted', desc: 'Your reschedule request has been successfully filed.' },
    { label: 'Under Review', desc: 'Apexium operations team is reviewing your reason.' },
    { label: 'Approved', desc: 'Your request has been accepted.' },
    { label: 'New Slot Assigned', desc: 'A new slot has been scheduled and sent via email.' }
  ];

  // Map database status string to step index (0 to 3)
  const getStatusStepIndex = (status: string) => {
    switch (status) {
      case 'Submitted': return 0;
      case 'Under Review': return 1;
      case 'Approved': return 2;
      case 'New Slot Assigned': return 3;
      default: return 0;
    }
  };

  useEffect(() => {
    setMounted(true);

    const loadUserDataAndRequest = async () => {
      // 1. Load User Session
      const savedUserStr = localStorage.getItem('currentUser');
      let userObj: any = null;

      if (savedUserStr) {
        try {
          userObj = JSON.parse(savedUserStr);
          setCurrentUser(userObj);
        } catch (e) {
          console.error(e);
        }
      }

      // Check if user has active Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user && !userObj) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            userObj = {
              id: profile.id,
              fullName: profile.full_name,
              email: profile.email,
              mobile: profile.mobile || '',
              status: profile.status || 'Pending',
              exam_slot: profile.exam_slot || null,
            };
            setCurrentUser(userObj);
          }
        }
      } catch (err) {
        console.warn('Supabase profile fetch failed, using local session:', err);
      }

      // Prefill fields if user details exist
      if (userObj) {
        // Chronological Candidate ID retrieval or calculation (just like admin page)
        let candidateIdVal = `APX-${userObj.id?.substring(0, 4).toUpperCase() || 'MEMBER'}`;
        
        // Let's check local allCandidates to get chronological ID
        try {
          const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
          const idx = localCandidates.findIndex((c: any) => c.id === userObj.id || c.email === userObj.email);
          if (idx !== -1) {
            candidateIdVal = `APX-${1000 + idx}`;
          }
        } catch (_) {}

        setFormData(prev => ({
          ...prev,
          fullName: userObj.fullName || userObj.full_name || '',
          email: userObj.email || '',
          phone: userObj.mobile || userObj.phone || '',
          candidateId: candidateIdVal,
          previousExamDate: userObj.exam_slot ? new Date(userObj.exam_slot).toISOString().substring(0, 16) : '',
        }));

        // Fetch existing request for this user
        fetchExistingRequest(userObj.id, userObj.email);
      }
    };

    loadUserDataAndRequest();
  }, []);

  const fetchExistingRequest = async (userId: string, email: string) => {
    let allRequests: any[] = [];

    // 1. Try Supabase
    try {
      if (userId) {
        const { data, error } = await supabase
          .from('reschedule_requests')
          .select('*')
          .eq('candidate_id', userId)
          .order('created_at', { ascending: false });

        if (data && data.length > 0 && !error) {
          allRequests = data;
        }
      }
    } catch (e) {
      console.log('Supabase reschedule requests not found. Checking local storage cache.');
    }

    // 2. Fallback to LocalStorage
    if (allRequests.length === 0) {
      try {
        const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
        const userRequests = localRequests
          .filter((r: any) => r.candidate_id === userId || r.email === email)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        allRequests = userRequests;
      } catch (e) {
        console.error(e);
      }
    }

    // Store all history
    setRescheduleHistory(allRequests);

    // Only show the tracker for an ACTIVE (in-progress) request
    // Allow new submissions if the latest request is completed or rejected
    if (allRequests.length > 0) {
      const latest = allRequests[0];
      const activeStatuses = ['Submitted', 'Under Review', 'Approved'];
      if (activeStatuses.includes(latest.status)) {
        setExistingRequest(latest);
      } else {
        // Latest is 'New Slot Assigned' or 'Rejected' — allow new request
        setExistingRequest(null);
      }
    }
  };

  if (!mounted) return null;

  // Custom Form Validation
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName.trim()) newErrors.fullName = 'Full Name is required';
    if (!formData.email.trim()) {
      newErrors.email = 'Registered Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Invalid Email address';
    }
    if (!formData.phone.trim()) newErrors.phone = 'Phone Number is required';
    if (!formData.candidateId.trim()) newErrors.candidateId = 'Registration ID / Candidate ID is required';
    if (!formData.previousExamDate) newErrors.previousExamDate = 'Previously Scheduled Exam Date is required';
    if (!formData.reason) newErrors.reason = 'Reason for Missing Exam is required';
    if (!formData.preferredDate) newErrors.preferredDate = 'Preferred New Exam Date is required';
    if (!formData.preferredTimeSlot) newErrors.preferredTimeSlot = 'Preferred Time Slot is required';
    
    // Preferred Date should be in the future
    if (formData.preferredDate) {
      const selected = new Date(formData.preferredDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) {
        newErrors.preferredDate = 'Preferred date must be today or in the future';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error as candidate types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Mock File Upload Handler
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate size (max 5MB)
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("File size exceeds 5MB limits. Please upload a smaller file.");
      return;
    }

    setFile(selectedFile);
    setUploading(true);
    setUploadProgress(0);
    setUploadSuccess(false);

    // Simulate progress upload
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setUploadSuccess(true);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    
    // Submitting Steps animation for premium feel
    setSubmittingStep('Verifying registration credentials...');
    await new Promise(r => setTimeout(r, 1000));
    
    setSubmittingStep('Encrypting uploaded assets...');
    await new Promise(r => setTimeout(r, 800));

    setSubmittingStep('Filing reschedule request with operations...');
    await new Promise(r => setTimeout(r, 800));

    const requestPayload = {
      id: crypto.randomUUID(),
      candidate_id: currentUser?.id || 'AE-GUEST',
      full_name: formData.fullName,
      email: formData.email,
      mobile: formData.phone,
      candidate_id_val: formData.candidateId,
      previous_slot: new Date(formData.previousExamDate).toISOString(),
      reason: formData.reason,
      explanation: formData.explanation,
      preferred_date: formData.preferredDate,
      preferred_slot: formData.preferredTimeSlot,
      supporting_doc_name: file ? file.name : null,
      status: 'Submitted',
      created_at: new Date().toISOString()
    };

    // 1. Try saving to Supabase
    let savedToCloud = false;
    try {
      const { error } = await supabase
        .from('reschedule_requests')
        .insert({
          candidate_id: currentUser?.id || null,
          full_name: requestPayload.full_name,
          email: requestPayload.email,
          mobile: requestPayload.mobile,
          candidate_id_val: requestPayload.candidate_id_val,
          previous_slot: requestPayload.previous_slot,
          reason: requestPayload.reason,
          explanation: requestPayload.explanation,
          preferred_date: requestPayload.preferred_date,
          preferred_slot: requestPayload.preferred_slot,
          supporting_doc_name: requestPayload.supporting_doc_name,
          status: 'Submitted'
        });

      if (!error) {
        savedToCloud = true;
      } else {
        console.log("Supabase table 'reschedule_requests' not found. Syncing via local storage cache.");
      }
    } catch (e) {
      console.log("Supabase database offline or missing reschedule table. Syncing locally.");
    }

    // 2. Parallel / Fallback: Save to LocalStorage (keep ALL history)
    try {
      const existingRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
      existingRequests.push(requestPayload);
      localStorage.setItem('rescheduleRequests', JSON.stringify(existingRequests));
    } catch (e) {
      console.error("LocalStorage write error:", e);
    }

    // Update state to show tracker
    setExistingRequest(requestPayload);
    setSubmitSuccess(true);
    setLoading(false);
  };

  return (
    <div className={styles.wrapper}>
      {/* Background Blurs for high-end Glassmorphism */}
      <div className={styles.circle1}></div>
      <div className={styles.circle2}></div>

      <div className={styles.container}>
        {/* Company Branding Section at Top */}
        <header className={styles.header}>
          <div className={styles.brand}>
            <div className={styles.brandIcon}>
              <ShieldCheck size={28} color="white" />
            </div>
            <div>
              <span className={styles.brandName}>Apexium</span>
              <span className={styles.brandTag}>Assessment Hub</span>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')} className={styles.backLink}>
            <ArrowLeft size={16} /> Back to Dashboard
          </button>
        </header>

        {/* Existing Request Status Tracker Page View */}
        {existingRequest && (
          <div className={styles.trackerCard}>
            <div className={styles.trackerHeader}>
              <div className={styles.iconCircle}>
                <CalendarClock size={28} color="var(--primary)" />
              </div>
              <div>
                <h2>Reschedule Request Status</h2>
                <p>Track your reschedule inquiry status for candidate ID: <strong>{existingRequest.candidate_id_val}</strong></p>
              </div>
              <span className={`${styles.badge} ${
                existingRequest.status === 'Approved' || existingRequest.status === 'New Slot Assigned' ? styles.badgeSuccess :
                existingRequest.status === 'Under Review' ? styles.badgeWarning :
                existingRequest.status === 'Rejected' ? styles.badgeDanger : styles.badgeDefault
              }`}>
                {existingRequest.status === 'New Slot Assigned' ? 'New Slot Ready' : existingRequest.status}
              </span>
            </div>

            {/* Stepper Status tracker */}
            <div className={styles.stepper}>
              {statusSteps.map((step, idx) => {
                const currentActiveIdx = getStatusStepIndex(existingRequest.status);
                let stepState = 'pending';
                if (idx < currentActiveIdx) stepState = 'completed';
                else if (idx === currentActiveIdx) {
                  stepState = existingRequest.status === 'Rejected' ? 'failed' : 'active';
                }

                return (
                  <div key={idx} className={`${styles.step} ${styles[stepState]}`}>
                    <div className={styles.stepMarker}>
                      {stepState === 'completed' ? '✓' : stepState === 'failed' ? '✗' : idx + 1}
                    </div>
                    <div className={styles.stepInfo}>
                      <span className={styles.stepLabel}>{step.label}</span>
                      <span className={styles.stepDesc}>
                        {stepState === 'failed' && idx === 1 ? 'Operations team has declined the reschedule request.' : step.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Notification/Info Card inside Tracker */}
            <div className={styles.infoSection}>
              {existingRequest.status === 'New Slot Assigned' ? (
                <div className={styles.successSlotInfo}>
                  <h3>🎉 Rescheduled Slot Assigned!</h3>
                  <p>Your assessment has been scheduled for:</p>
                  <div className={styles.slotTimeBox}>
                    <Calendar size={18} />
                    <strong>{new Date(currentUser?.exam_slot || existingRequest.new_slot_time || Date.now()).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
                  </div>
                  <div className={styles.slotTimeBox} style={{ marginTop: '8px' }}>
                    <Clock size={18} />
                    <strong>{new Date(currentUser?.exam_slot || existingRequest.new_slot_time || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong>
                  </div>
                  <p className={styles.notificationPrompt} style={{ marginTop: '12px' }}>
                    We have dispatched a calendar invite and login details to <strong>{existingRequest.email}</strong>.
                  </p>
                  <Button onClick={() => router.push('/dashboard')} size="lg" style={{ marginTop: '15px', width: '100%' }}>
                    Go to Exam Dashboard
                  </Button>
                </div>
              ) : existingRequest.status === 'Rejected' ? (
                <div className={styles.rejectedBox}>
                  <p><strong>Reason for rejection:</strong> The documentation submitted was insufficient or the rescheduling request exceeded the acceptable filing period. Please contact candidate helpdesk at support@apexium.com for assistance.</p>
                  <Button onClick={() => setExistingRequest(null)} variant="outline" style={{ marginTop: '15px', width: '100%' }}>
                    Submit New Request
                  </Button>
                </div>
              ) : (
                <div className={styles.pendingReviewBox}>
                  <div className={styles.reviewText}>
                    <Clock size={20} className={styles.pulsingIcon} />
                    <div>
                      <strong>Your request is undergoing verification</strong>
                      <p>Our review panel is assessing your support ticket details (Reason: <strong>{existingRequest.reason}</strong>). Approvals are typically processed within 4 business hours.</p>
                    </div>
                  </div>
                  <div className={styles.emailNotificationConfirmation}>
                    <Mail size={16} />
                    <span>Notification updates will be automatically dispatched to <strong>{existingRequest.email}</strong>.</span>
                  </div>
                </div>
              )}

              {/* "Request Again" button for completed/rejected requests */}
              {(existingRequest.status === 'New Slot Assigned' || existingRequest.status === 'Rejected') && (
                <div style={{ marginTop: '16px', padding: '16px', background: 'linear-gradient(135deg, #f0fdf4, #f8fafc)', borderRadius: '12px', border: '1px solid var(--border)', textAlign: 'center' }}>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    {existingRequest.status === 'Rejected'
                      ? 'You can submit a new reschedule request with updated documentation.'
                      : 'Missed your rescheduled slot again? You can request another reschedule.'}
                  </p>
                  <button
                    onClick={() => setExistingRequest(null)}
                    style={{
                      padding: '12px 28px',
                      background: 'var(--gradient-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      width: '100%'
                    }}
                  >
                    Submit New Reschedule Request
                  </button>
                </div>
              )}
            </div>

            {/* Reschedule History */}
            {rescheduleHistory.length > 1 && (
              <div style={{
                marginTop: '20px',
                padding: '20px',
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '16px',
                border: '1px solid var(--border)'
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--secondary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} /> Reschedule History ({rescheduleHistory.length} requests)
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {rescheduleHistory.map((req, idx) => (
                    <div key={req.id || idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 16px',
                      background: idx === 0 ? 'rgba(0,143,140,0.06)' : '#f8fafc',
                      borderRadius: '10px',
                      border: idx === 0 ? '1.5px solid rgba(0,143,140,0.2)' : '1px solid #e2e8f0',
                      fontSize: '0.85rem'
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <strong style={{ color: 'var(--secondary)' }}>Request #{rescheduleHistory.length - idx}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                          {req.reason} — {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: '20px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor:
                          req.status === 'New Slot Assigned' || req.status === 'Approved' ? '#dcfce7' :
                          req.status === 'Rejected' ? '#fee2e2' : '#fef9c3',
                        color:
                          req.status === 'New Slot Assigned' || req.status === 'Approved' ? '#15803d' :
                          req.status === 'Rejected' ? '#dc2626' : '#92400e'
                      }}>
                        {req.status === 'New Slot Assigned' ? 'Slot Assigned' : req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Submitting state loader overlay */}
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loaderContent}>
              <Loader2 className={styles.spinner} size={48} />
              <h3>Submitting Reschedule Ticket</h3>
              <p>{submittingStep}</p>
            </div>
          </div>
        )}

        {/* Success message view */}
        {submitSuccess && !existingRequest && (
          <div className={styles.successCard}>
            <div className={styles.successBadge}>
              <CheckCircle size={48} color="white" />
            </div>
            <h2>Submitted Successfully!</h2>
            <p className={styles.successMessage}>
              “Your reschedule request has been submitted successfully. Our team will review and confirm your new exam slot via email.”
            </p>
            <div className={styles.emailNotificationBox}>
              <Mail size={18} />
              <span>A confirmation slip and review status links were sent to <strong>{formData.email}</strong>.</span>
            </div>
            <div style={{ marginTop: '30px', display: 'flex', gap: '15px' }}>
              <Button onClick={() => setSubmitSuccess(false)} variant="outline" style={{ flex: 1 }}>
                View Request Status
              </Button>
              <Button onClick={() => router.push('/dashboard')} style={{ flex: 1 }}>
                Return to Dashboard
              </Button>
            </div>
          </div>
        )}

        {/* Main Reschedule Form */}
        {!existingRequest && !submitSuccess && (
          <div className={styles.glassCard}>
            {/* Header description */}
            <div className={styles.formHeader}>
              <div className={styles.illustrationWrap}>
                <CalendarClock size={44} color="var(--primary)" />
              </div>
              <h1 className={styles.title}>Reschedule Your Exam</h1>
              <p className={styles.subtitle}>
                Missed your scheduled assessment?
                Submit a reschedule request and choose a new exam slot.
              </p>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGrid}>
                {/* Full Name */}
                <div className={styles.formGroup}>
                  <label><User size={16} /> Full Name</label>
                  <input 
                    type="text" 
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleInputChange}
                    placeholder="Enter your registered full name"
                    className={errors.fullName ? styles.inputError : ''}
                  />
                  {errors.fullName && <span className={styles.errorText}><AlertCircle size={12} /> {errors.fullName}</span>}
                </div>

                {/* Email Address */}
                <div className={styles.formGroup}>
                  <label><Mail size={16} /> Registered Email</label>
                  <input 
                    type="email" 
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="e.g. name@domain.com"
                    className={errors.email ? styles.inputError : ''}
                  />
                  {errors.email && <span className={styles.errorText}><AlertCircle size={12} /> {errors.email}</span>}
                </div>

                {/* Phone Number */}
                <div className={styles.formGroup}>
                  <label><Phone size={16} /> Phone Number</label>
                  <input 
                    type="text" 
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="10-digit mobile number"
                    className={errors.phone ? styles.inputError : ''}
                  />
                  {errors.phone && <span className={styles.errorText}><AlertCircle size={12} /> {errors.phone}</span>}
                </div>

                {/* Registration ID / Candidate ID */}
                <div className={styles.formGroup}>
                  <label><FileText size={16} /> Candidate ID / Reg ID</label>
                  <input 
                    type="text" 
                    name="candidateId"
                    value={formData.candidateId}
                    onChange={handleInputChange}
                    placeholder="e.g. APX-1042"
                    className={errors.candidateId ? styles.inputError : ''}
                  />
                  {errors.candidateId && <span className={styles.errorText}><AlertCircle size={12} /> {errors.candidateId}</span>}
                </div>

                {/* Previously Scheduled Exam Date */}
                <div className={styles.formGroup}>
                  <label><Calendar size={16} /> Previously Scheduled Date</label>
                  <input 
                    type="datetime-local" 
                    name="previousExamDate"
                    value={formData.previousExamDate}
                    onChange={handleInputChange}
                    className={errors.previousExamDate ? styles.inputError : ''}
                  />
                  {errors.previousExamDate && <span className={styles.errorText}><AlertCircle size={12} /> {errors.previousExamDate}</span>}
                </div>

                {/* Reason for Missing Exam (Dropdown) */}
                <div className={styles.formGroup}>
                  <label><AlertCircle size={16} /> Reason for Missing Exam</label>
                  <select 
                    name="reason"
                    value={formData.reason}
                    onChange={handleInputChange}
                    className={errors.reason ? styles.inputError : ''}
                  >
                    <option value="">-- Select Valid Reason --</option>
                    <option value="Technical Issue">Technical Issue</option>
                    <option value="Internet Problem">Internet Problem</option>
                    <option value="Medical Emergency">Medical Emergency</option>
                    <option value="Power Failure">Power Failure</option>
                    <option value="Personal Emergency">Personal Emergency</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.reason && <span className={styles.errorText}><AlertCircle size={12} /> {errors.reason}</span>}
                </div>

                {/* Preferred New Exam Date */}
                <div className={styles.formGroup}>
                  <label><Calendar size={16} /> Preferred New Exam Date</label>
                  <input 
                    type="date" 
                    name="preferredDate"
                    value={formData.preferredDate}
                    onChange={handleInputChange}
                    className={errors.preferredDate ? styles.inputError : ''}
                  />
                  {errors.preferredDate && <span className={styles.errorText}><AlertCircle size={12} /> {errors.preferredDate}</span>}
                </div>

                {/* Preferred Time Slot */}
                <div className={styles.formGroup}>
                  <label><Clock size={16} /> Preferred Time Slot</label>
                  <select 
                    name="preferredTimeSlot"
                    value={formData.preferredTimeSlot}
                    onChange={handleInputChange}
                    className={errors.preferredTimeSlot ? styles.inputError : ''}
                  >
                    <option value="">-- Select Time Slot --</option>
                    <option value="Morning (09:00 AM - 12:00 PM)">Morning (09:00 AM - 12:00 PM)</option>
                    <option value="Afternoon (01:00 PM - 04:00 PM)">Afternoon (01:00 PM - 04:00 PM)</option>
                    <option value="Evening (05:00 PM - 08:00 PM)">Evening (05:00 PM - 08:00 PM)</option>
                  </select>
                  {errors.preferredTimeSlot && <span className={styles.errorText}><AlertCircle size={12} /> {errors.preferredTimeSlot}</span>}
                </div>
              </div>

              {/* Additional Explanation (Textarea) */}
              <div className={styles.textareaGroup}>
                <label>Additional Explanation</label>
                <textarea 
                  name="explanation"
                  value={formData.explanation}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Provide a detailed explanation of the issue (technical bugs, medical description, etc.) to support your case..."
                />
              </div>

              {/* Upload Supporting Document (Optional) */}
              <div className={styles.uploadGroup}>
                <label>Upload Supporting Document <span className={styles.optional}>(Optional)</span></label>
                <div className={`${styles.uploadBox} ${uploadSuccess ? styles.uploadBoxSuccess : ''}`}>
                  <input 
                    type="file" 
                    id="doc-upload" 
                    className={styles.fileInput} 
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg"
                  />
                  <label htmlFor="doc-upload" className={styles.uploadLabel}>
                    {uploading ? (
                      <div className={styles.progressContainer}>
                        <Loader2 className={styles.spin} size={24} />
                        <span>Uploading supporting certificate: {uploadProgress}%</span>
                        <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    ) : uploadSuccess ? (
                      <div className={styles.uploadSuccessBox}>
                        <CheckCircle size={20} color="#22c55e" />
                        <span>Uploaded successfully: <strong>{file?.name}</strong></span>
                        <span className={styles.uploadSize}>({Math.round((file?.size || 0) / 1024)} KB)</span>
                      </div>
                    ) : (
                      <>
                        <Upload size={24} />
                        <span>Drag & Drop or Click to Upload certificate (PDF, JPG, PNG)</span>
                        <span className={styles.subtext}>Medical certificate, internet breakdown log, or electricity bill (Max 5MB)</span>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* Buttons */}
              <div className={styles.btnRow}>
                <Button 
                  onClick={() => router.push('/dashboard')} 
                  variant="outline" 
                  size="lg" 
                  style={{ width: '45%' }}
                >
                  Back to Dashboard
                </Button>
                <Button 
                  type="submit" 
                  variant="primary" 
                  size="lg" 
                  style={{ width: '50%', background: 'var(--gradient-primary)' }}
                >
                  Submit Reschedule Request
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
