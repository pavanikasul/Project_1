'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Info, FileText, Clock, Lock, CheckCircle } from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState(new Date());
  const [rescheduleRequest, setRescheduleRequest] = useState<any>(null);
  const [hasTakenExam, setHasTakenExam] = useState(false);
  const [candidateScore, setCandidateScore] = useState<number | null>(null);

  const calculateScoreFromLocal = (parsed: any) => {
    try {
      const localStr = localStorage.getItem('examResult');
      let targetResult = localStr ? JSON.parse(localStr) : null;

      // CRITICAL: Validate examResult belongs to THIS candidate.
      // examResult is a shared localStorage key — a leftover result from
      // a previous candidate on the same browser must not pollute this user.
      if (targetResult) {
        const resultId = targetResult.candidateId || targetResult.candidate_id;
        const resultEmail = targetResult.candidateEmail || targetResult.email;
        const resultName = targetResult.candidateName || targetResult.fullName;
        const idMatch = resultId && (resultId === parsed.id);
        const emailMatch = resultEmail && parsed.email && resultEmail.toLowerCase() === parsed.email.toLowerCase();
        const nameMatch = resultName && (parsed.fullName || parsed.full_name) &&
          resultName.toLowerCase() === (parsed.fullName || parsed.full_name).toLowerCase();
        if (!idMatch && !emailMatch && !nameMatch) {
          // This result does NOT belong to the current user — ignore it
          targetResult = null;
        }
      }

      // Fallback: check allSubmissions for this specific user
      if (!targetResult) {
        const allSubmissions = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
        const userSub = allSubmissions.find((s: any) => 
          s.candidate_id === parsed.id || 
          s.profiles?.email?.toLowerCase() === parsed.email?.toLowerCase() ||
          s.profiles?.full_name?.toLowerCase() === (parsed.fullName || parsed.full_name)?.toLowerCase()
        );
        if (userSub) targetResult = userSub.score_data;
      }

      if (targetResult) {
        const examData = targetResult.examData || [];
        const answers = targetResult.answers || {};

        let correctCount = 0;
        let totalQuestions = 0;

        examData.forEach((section: any) => {
          const questions = section.questions || [];
          questions.forEach((q: any) => {
            totalQuestions++;
            const userAnswer = answers[q.id];
            const correctAnswer = q.answer;

            if (q.type === 'MSQ') {
              const uAns = Array.isArray(userAnswer) ? [...userAnswer].sort() : [];
              const cAns = Array.isArray(correctAnswer) ? [...correctAnswer].sort() : [];
              if (JSON.stringify(uAns) === JSON.stringify(cAns)) correctCount++;
            } else if (q.type === 'FIB') {
              if (userAnswer?.toString().trim().toLowerCase() === correctAnswer?.toString().trim().toLowerCase()) correctCount++;
            } else {
              if (userAnswer === correctAnswer) correctCount++;
            }
          });
        });

        if (totalQuestions > 0) {
          return Math.round((correctCount / totalQuestions) * 100);
        }
      }
    } catch (_) {}
    return null;
  };

  const parseRescheduledSlotTime = (preferredDate: string, preferredSlot: string): Date | null => {
    if (!preferredDate) return null;
    const match = preferredSlot?.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    let hour = 0, minute = 0;
    if (match) {
      hour = parseInt(match[1], 10);
      minute = parseInt(match[2], 10);
      const meridiem = match[3].toUpperCase();
      if (meridiem === 'PM' && hour !== 12) hour += 12;
      if (meridiem === 'AM' && hour === 12) hour = 0;
    }
    const d = new Date(preferredDate);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const getRescheduledSlotTime = (request: any): Date | null => {
    if (!request) return null;
    if (request.new_slot_time) return new Date(request.new_slot_time);
    if (request.preferred_date) return parseRescheduledSlotTime(request.preferred_date, request.preferred_slot || '');
    return null;
  };

  useEffect(() => {
    setMounted(true);

    const loadUser = async () => {
      // 1. Try localStorage first (fastest)
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        let parsed: any = null;
        try {
          parsed = JSON.parse(savedUser);
        } catch (err) {
          console.warn('Failed to parse saved currentUser:', err);
          localStorage.removeItem('currentUser');
        }

        if (parsed) {
          try {
            // ── Sync exam_slot from allCandidates (admin may have updated it) ──
            try {
              const allCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
              const match = allCandidates.find((c: any) =>
                c.email?.toLowerCase() === parsed.email?.toLowerCase() || c.id === parsed.id
              );
              if (match?.exam_slot && match.exam_slot !== parsed.exam_slot) {
                parsed = { ...parsed, exam_slot: match.exam_slot, status: match.status || parsed.status };
                localStorage.setItem('currentUser', JSON.stringify(parsed));
              }
            } catch (_) {}

            // ── Also try refreshing exam_slot from Supabase profile ──
            try {
              const { data: freshProfile } = await supabase
                .from('profiles')
                .select('exam_slot, status')
                .eq('id', parsed.id)
                .single();
              if (freshProfile?.exam_slot && freshProfile.exam_slot !== parsed.exam_slot) {
                parsed = { ...parsed, exam_slot: freshProfile.exam_slot, status: freshProfile.status || parsed.status };
                localStorage.setItem('currentUser', JSON.stringify(parsed));
              }
            } catch (_) {}

            setUser(parsed);

            // ── Load reschedule request: merge Supabase + localStorage, prefer 'New Slot Assigned' ──
            let activeRescheduleSlot: Date | null = null;
            try {
              const { data: reqData } = await supabase
                .from('reschedule_requests')
                .select('*')
                .eq('candidate_id', parsed.id)
                .order('created_at', { ascending: false });

              const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
              const localSorted = localRequests
                .filter((r: any) => r.email === parsed.email || r.candidate_id === parsed.id)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              const localLatest = localSorted[0] || null;

              // Prefer localStorage record when it carries 'New Slot Assigned'
              // (Supabase CHECK constraint rejects this status so cloud record lags behind)
              if (localLatest?.status === 'New Slot Assigned') {
                setRescheduleRequest(localLatest);
                activeRescheduleSlot = getRescheduledSlotTime(localLatest);
                // Clear old exam result since this is a rescheduled slot
                localStorage.removeItem('examResult');
              } else if (reqData && reqData.length > 0) {
                setRescheduleRequest(reqData[0]);
                activeRescheduleSlot = getRescheduledSlotTime(reqData[0]);
                if (reqData[0]?.status === 'New Slot Assigned') {
                  localStorage.removeItem('examResult');
                }
              } else if (localLatest) {
                setRescheduleRequest(localLatest);
                activeRescheduleSlot = getRescheduledSlotTime(localLatest);
              }
            } catch (_) {
              const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
              const localSorted = localRequests
                .filter((r: any) => r.email === parsed.email)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              if (localSorted[0]) {
                setRescheduleRequest(localSorted[0]);
                activeRescheduleSlot = getRescheduledSlotTime(localSorted[0]);
                // Clear old exam result since this is a rescheduled slot
                if (localSorted[0]?.status === 'New Slot Assigned') {
                  localStorage.removeItem('examResult');
                }
              }
            }

            // ── Check if exam was actually completed (requires real score_data) ──
            try {
              const score = calculateScoreFromLocal(parsed);
              if (score !== null) {
                setHasTakenExam(true);
                setCandidateScore(score);
              } else {
                const { data: subData } = await supabase
                  .from('submissions')
                  .select('id, status, score_data')
                  .eq('candidate_id', parsed.id)
                  .eq('status', 'submitted')
                  .order('created_at', { ascending: false });
                if (subData && subData.length > 0) {
                  const validSubmission = activeRescheduleSlot
                    ? subData.find((s: any) => {
                        const submittedAt = s.score_data?.submittedAt ? new Date(s.score_data.submittedAt).getTime() : null;
                        return submittedAt && submittedAt >= activeRescheduleSlot!.getTime();
                      })
                    : subData[0];
                  if (validSubmission) {
                    setHasTakenExam(true);
                    const sd = validSubmission.score_data;
                    if (sd) {
                      const examData = sd.examData || [];
                      const answers = sd.answers || {};
                      let correct = 0, total = 0;
                      examData.forEach((sec: any) => sec.questions?.forEach((q: any) => {
                        total++;
                        const ua = answers[q.id];
                        if (q.type === 'MSQ') {
                          if (JSON.stringify([...(Array.isArray(ua)?ua:[])].sort()) === JSON.stringify([...(Array.isArray(q.answer)?q.answer:[])].sort())) correct++;
                        } else if (q.type === 'FIB') {
                          if (ua?.toString().trim().toLowerCase() === q.answer?.toString().trim().toLowerCase()) correct++;
                        } else { if (ua === q.answer) correct++; }
                      }));
                      if (total > 0) setCandidateScore(Math.round((correct / total) * 100));
                    }
                  }
                }
              }
            } catch (_) {}
          } catch (err) {
            console.warn('Saved user refresh failed:', err);
          }

          return;
        }
      }

      // 2. Fallback: check if logged in via Supabase (cross-device support)
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile) {
            const sessionUser = {
              id: profile.id,
              fullName: profile.full_name || 'Candidate',
              full_name: profile.full_name || 'Candidate',
              email: profile.email || session.user.email,
              mobile: profile.mobile || '',
              idType: profile.id_proof_type || 'Aadhar Card',
              idNumber: profile.id_proof_number || '',
              city: profile.city || '',
              state: profile.state || '',
              role: profile.role || 'candidate',
              status: profile.status || 'Pending',
              exam_slot: profile.exam_slot || null,
              password: ''
            };
            localStorage.setItem('currentUser', JSON.stringify(sessionUser));
            setUser(sessionUser);
            
            // ── Load reschedule request: merge Supabase + localStorage, prefer 'New Slot Assigned' ──
            let activeRescheduleSlot: Date | null = null;
            try {
              const { data: reqData } = await supabase
                .from('reschedule_requests')
                .select('*')
                .eq('candidate_id', sessionUser.id)
                .order('created_at', { ascending: false });

              const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
              const localSorted = localRequests
                .filter((r: any) => r.email === sessionUser.email || r.candidate_id === sessionUser.id)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              const localLatest = localSorted[0] || null;

              if (localLatest?.status === 'New Slot Assigned') {
                setRescheduleRequest(localLatest);
                activeRescheduleSlot = getRescheduledSlotTime(localLatest);
                // Clear old exam result since this is a rescheduled slot
                localStorage.removeItem('examResult');
              } else if (reqData && reqData.length > 0) {
                setRescheduleRequest(reqData[0]);
                activeRescheduleSlot = getRescheduledSlotTime(reqData[0]);
                if (reqData[0]?.status === 'New Slot Assigned') {
                  localStorage.removeItem('examResult');
                }
              } else if (localLatest) {
                setRescheduleRequest(localLatest);
                activeRescheduleSlot = getRescheduledSlotTime(localLatest);
              }
            } catch (_) {
              const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
              const localSorted = localRequests
                .filter((r: any) => r.email === sessionUser.email)
                .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              if (localSorted[0]) {
                setRescheduleRequest(localSorted[0]);
                activeRescheduleSlot = getRescheduledSlotTime(localSorted[0]);
                // Clear old exam result since this is a rescheduled slot
                if (localSorted[0]?.status === 'New Slot Assigned') {
                  localStorage.removeItem('examResult');
                }
              }
            }

            // ── Check if exam was actually completed (requires real score_data) ──
            try {
              const score = calculateScoreFromLocal(sessionUser, activeRescheduleSlot);
              if (score !== null) {
                setHasTakenExam(true);
                setCandidateScore(score);
              } else {
                const { data: subData } = await supabase
                  .from('submissions')
                  .select('id, status, score_data')
                  .eq('candidate_id', sessionUser.id)
                  .eq('status', 'submitted')
                  .order('created_at', { ascending: false });
                if (subData && subData.length > 0) {
                  const validSubmission = activeRescheduleSlot
                    ? subData.find((s: any) => {
                        const submittedAt = s.score_data?.submittedAt ? new Date(s.score_data.submittedAt).getTime() : null;
                        return submittedAt && submittedAt >= activeRescheduleSlot!.getTime();
                      })
                    : subData[0];
                  if (validSubmission) {
                    setHasTakenExam(true);
                    const sd = validSubmission.score_data;
                    if (sd) {
                      const examData = sd.examData || [];
                      const answers = sd.answers || {};
                      let correct = 0, total = 0;
                      examData.forEach((sec: any) => sec.questions?.forEach((q: any) => {
                        total++;
                        const ua = answers[q.id];
                        if (q.type === 'MSQ') {
                          if (JSON.stringify([...(Array.isArray(ua)?ua:[])].sort()) === JSON.stringify([...(Array.isArray(q.answer)?q.answer:[])].sort())) correct++;
                        } else if (q.type === 'FIB') {
                          if (ua?.toString().trim().toLowerCase() === q.answer?.toString().trim().toLowerCase()) correct++;
                        } else { if (ua === q.answer) correct++; }
                      }));
                      if (total > 0) setCandidateScore(Math.round((correct / total) * 100));
                    }
                  }
                }
              }
            } catch (_) {}

              return;
            }
          }
      } catch (err) {
        console.warn('Supabase session fetch failed:', err);
      }

      // 3. No session found — redirect to register
      window.location.href = '/register';
    };

    loadUser();

    // Live clock — ticks every second so countdown stays accurate
    const ticker = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(ticker);
  }, []);

  if (!mounted || !user) return null;

  // ── Time-gate logic (30-min window) ──────────────────────────────
  const WINDOW_MS = 30 * 60 * 1000; // 30 minutes in ms

  // If a reschedule has been approved and a new slot assigned, use it as the effective exam time.
  // Priority: new_slot_time (exact datetime admin assigned) > preferred_date+slot parse > original slot
  const rescheduledSlotTime = (() => {
    if (rescheduleRequest?.status !== 'New Slot Assigned') return null;
    // 1st: use the exact new_slot_time the admin entered
    if (rescheduleRequest.new_slot_time) return new Date(rescheduleRequest.new_slot_time);
    // 2nd: parse preferred_date + preferred_slot label
    if (rescheduleRequest.preferred_date)
      return parseRescheduledSlotTime(rescheduleRequest.preferred_date, rescheduleRequest.preferred_slot || '');
    return null;
  })();

  const examSlotTime = rescheduledSlotTime ?? (user.exam_slot ? new Date(user.exam_slot) : null);
  const nowMs = now.getTime();
  const slotMs = examSlotTime ? examSlotTime.getTime() : null;

  const examNotYetStarted  = slotMs !== null && nowMs < slotMs;                      // before slot
  const examWindowOpen     = slotMs !== null && nowMs >= slotMs && nowMs < slotMs + WINDOW_MS; // within 30-min window
  const examWindowExpired  = slotMs !== null && nowMs >= slotMs + WINDOW_MS;         // missed the window

  // Countdown to slot start
  const msUntilExam = slotMs ? slotMs - nowMs : null;
  // Time remaining in the window
  const msWindowLeft = slotMs ? (slotMs + WINDOW_MS) - nowMs : null;

  const formatCountdown = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };
  // ─────────────────────────────────────────────────────────────────

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Your Exams</h1>
          <p className={styles.subtitle}>Complete your assigned assessment to proceed.</p>
        </div>
        <div className={styles.userInfo}>
          <div className={styles.avatar}>{user.fullName ? user.fullName[0].toUpperCase() : 'U'}</div>
          <div>
            <p className={styles.userName}>{user.fullName || 'Candidate'}</p>
            <p className={styles.userStatus}>Verified Candidate</p>
          </div>
        </div>
      </header>

      {/* Reschedule status quick-tracker banner */}
      {rescheduleRequest && (
        <div style={{
          marginBottom: '24px',
          padding: '16px 24px',
          background: 'linear-gradient(135deg, rgba(0, 143, 140, 0.08) 0%, rgba(10, 53, 87, 0.03) 100%)',
          borderRadius: '16px',
          border: '1.5px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(0, 143, 140, 0.1)',
              color: 'var(--primary)',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Clock size={18} />
            </div>
            <div>
              <span style={{ fontSize: '0.92rem', fontWeight: 800, color: 'var(--secondary)', display: 'block' }}>
                Reschedule Ticket: {rescheduleRequest.status === 'New Slot Assigned' ? 'New Slot Scheduled' : rescheduleRequest.status}
              </span>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {rescheduleRequest.status === 'Submitted' && 'Your request has been filed successfully and is currently under review.'}
                {rescheduleRequest.status === 'Under Review' && 'Our operations review panel is validating your documentation details.'}
                {rescheduleRequest.status === 'Approved' && 'Your reschedule ticket has been accepted! Assigning new slot time.'}
                {rescheduleRequest.status === 'Rejected' && 'Your reschedule inquiry was declined due to insufficient parameters.'}
                {rescheduleRequest.status === 'New Slot Assigned' && 'A new slot time has been assigned to you. Launch details sent to email.'}
              </span>
            </div>
          </div>
          <Link href="/dashboard/reschedule">
            <Button size="sm" style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: 'bold' }}>
              Track Ticket
            </Button>
          </Link>
        </div>
      )}

      <div className={styles.assignedSection}>
        <div className={styles.examCard}>
          <div className={styles.examInfo}>
            <div className={styles.examIcon}>
              <FileText size={32} />
            </div>
            <div className={styles.examText}>
              <h2 className={styles.examTitle}>Aptitude Edge - Online Assessment</h2>
              <p className={styles.examDescription}>
                You have been assigned the following assessment. Please ensure your environment is ready for proctoring.
              </p>
            </div>
          </div>
          
          <div className={styles.infoBox}>
            <div className={styles.infoTitle}>
              <Info size={20} />
              <span>Before you begin</span>
            </div>
            <p className={styles.infoText}>
              Please complete the security verification process to confirm your identity and ensure a secure testing environment.
            </p>
          </div>

          {user.status === 'Pending' ? (
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-alt)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <h3 style={{ color: 'var(--warning)', marginBottom: '10px' }}>Pending Admin Approval</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Please wait while we verify your registration. We will contact you within 24 hours with the exam schedule and further instructions.
              </p>
            </div>

          ) : user.status === 'Rejected' ? (
            <div style={{ padding: '20px', backgroundColor: '#fef2f2', borderRadius: 'var(--radius-md)', border: '1px solid #fee2e2', textAlign: 'center' }}>
              <h3 style={{ color: '#ef4444', marginBottom: '10px' }}>Registration Rejected</h3>
              <p style={{ color: '#b91c1c' }}>
                Unfortunately, your registration has been rejected by the administrator. Please contact support if you believe this is an error.
              </p>
            </div>

          ) : examNotYetStarted ? (
            /* ── PRE-SLOT LOCK: Countdown to slot ── */
            <div style={{
              padding: '28px 24px',
              background: 'linear-gradient(135deg, #0A3557 0%, #0d4a73 100%)',
              borderRadius: '12px',
              border: '1px solid #1e5a8a',
              textAlign: 'center',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <Lock size={22} color="#fbbf24" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fbbf24' }}>Exam Access Locked</h3>
              </div>
              <p style={{ margin: '0 0 20px 0', fontSize: '0.9rem', color: '#93c5fd' }}>
                Your exam will unlock automatically at your scheduled time.
              </p>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '12px',
                background: 'rgba(0,0,0,0.3)', borderRadius: '10px',
                padding: '16px 28px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '20px'
              }}>
                <Clock size={28} color="#34d399" />
                <span style={{ fontSize: '2rem', fontWeight: 800, fontFamily: 'monospace', letterSpacing: '2px', color: '#34d399' }}>
                  {formatCountdown(msUntilExam!)}
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: '#bfdbfe', marginTop: '4px' }}>
                <strong style={{ color: '#fff' }}>Scheduled Time: </strong>
                {examSlotTime!.toLocaleString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <p style={{ marginTop: '16px', fontSize: '0.8rem', color: '#94a3b8' }}>
                Keep this page open — the button will appear automatically when your slot begins.
              </p>
            </div>

          ) : hasTakenExam ? (
            /* ── ALREADY TOOK THE EXAM — only shown if real score_data exists ── */
            <div style={{
              padding: '28px 24px',
              background: candidateScore !== null
                ? (candidateScore >= 40
                    ? 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)')
                : 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
              borderRadius: '12px',
              border: candidateScore !== null
                ? (candidateScore >= 40 ? '1px solid #86efac' : '1px solid #fecaca')
                : '1px solid #059669',
              textAlign: 'center',
              color: candidateScore !== null ? '#1e293b' : '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <CheckCircle size={24} color={candidateScore !== null ? (candidateScore >= 40 ? '#10b981' : '#f43f5e') : '#6ee7b7'} />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: candidateScore !== null ? (candidateScore >= 40 ? '#065f46' : '#991b1b') : '#6ee7b7' }}>
                  Exam Completed
                </h3>
              </div>

              {candidateScore !== null ? (
                <div style={{ margin: '16px 0', padding: '16px', background: 'white', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                  {candidateScore >= 40 ? (
                    <p style={{ margin: 0, fontSize: '1rem', color: '#15803d', fontWeight: 600, lineHeight: 1.6 }}>
                      🎉 Congratulations! You have reached the cutoff. We will contact you soon!
                    </p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '1rem', color: '#b91c1c', fontWeight: 600, lineHeight: 1.6 }}>
                      😔 You did not reach the cutoff. Don't give up — you can reschedule and try again!
                    </p>
                  )}
                </div>
              ) : (
                <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#a7f3d0', lineHeight: 1.6 }}>
                  Your submission has been securely recorded.
                </p>
              )}

              <Link href="/result" style={{ display: 'block', width: '100%', marginTop: '16px' }}>
                <Button size="md" style={{ width: '100%', background: candidateScore !== null ? (candidateScore >= 40 ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #f43f5e, #e11d48)') : 'linear-gradient(135deg, #10b981, #059669)', border: 'none', color: '#fff', fontWeight: 700 }}>
                  View Submission Details
                </Button>
              </Link>

              {/* Reschedule only allowed if candidate did NOT reach the cutoff */}
              {candidateScore !== null && candidateScore < 40 && (
                <Link href="/dashboard/reschedule" style={{ display: 'block', width: '100%', marginTop: '10px' }}>
                  <Button size="md" style={{ width: '100%', background: 'linear-gradient(135deg, #008F8C, #0A3557)', border: 'none', color: '#fff', fontWeight: 700 }}>
                    Request Reschedule & Retry
                  </Button>
                </Link>
              )}
            </div>

          ) : examWindowExpired ? (
            /* ── POST-WINDOW LOCK: 30-min deadline missed ── */
            <div style={{
              padding: '28px 24px',
              background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
              borderRadius: '12px',
              border: '1px solid #991b1b',
              textAlign: 'center',
              color: '#fff'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '8px' }}>
                <Lock size={22} color="#fca5a5" />
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fca5a5' }}>Exam Access Expired</h3>
              </div>
              <p style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: '#fecaca', lineHeight: 1.6 }}>
                You did not start the exam within the <strong>30-minute window</strong> after your scheduled slot.
                You can request a reschedule to get a new exam slot.
              </p>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '10px',
                padding: '14px 20px',
                marginBottom: '16px',
                fontSize: '0.85rem',
                color: '#fca5a5'
              }}>
                <div>📅 Slot was: <strong>{examSlotTime!.toLocaleString()}</strong></div>
                <div style={{ marginTop: '6px' }}>⏰ Deadline was: <strong>{new Date(slotMs! + WINDOW_MS).toLocaleString()}</strong></div>
              </div>
              <Link href="/dashboard/reschedule" style={{ display: 'block', width: '100%', marginTop: '16px' }}>
                <Button size="md" style={{ width: '100%', background: 'linear-gradient(135deg, #008F8C, #0A3557)', border: 'none', color: '#fff', fontWeight: 700 }}>
                  Request Exam Reschedule
                </Button>
              </Link>
            </div>

          ) : examWindowOpen ? (
            /* ── EXAM WINDOW OPEN: Start button with countdown ── */
            <div className={styles.actionArea}>
              <div style={{
                marginBottom: '15px',
                padding: '12px 16px',
                background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid #86efac',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={16} color="#16a34a" />
                  <span style={{ fontSize: '0.9rem', color: '#15803d', fontWeight: 600 }}>
                    Exam Slot Active — Start Now!
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#fef9c3', padding: '4px 10px', borderRadius: '20px', border: '1px solid #fde047' }}>
                  <Clock size={14} color="#ca8a04" />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#92400e', fontFamily: 'monospace' }}>
                    Window closes in: {formatCountdown(msWindowLeft!)}
                  </span>
                </div>
              </div>
              <Link href="/verification?examId=set-a" className={styles.primaryLink}>
                <Button size="lg" style={{ width: '100%', height: '56px', fontSize: '1.1rem', fontWeight: 800 }}>
                  Start Security Verification
                </Button>
              </Link>
              <p className={styles.notice}>
                ⚠ You have 30 minutes from your scheduled slot to begin. After that, access will be permanently revoked.
              </p>
            </div>

          ) : (
            /* ── No slot assigned yet ── */
            <div style={{ padding: '20px', backgroundColor: 'var(--bg-alt)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)' }}>No exam slot has been scheduled yet. Please contact your administrator.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

// Simple clsx utility since I can't import it here easily without checking
function clsx(...args: any[]) {
  return args.filter(Boolean).join(' ');
}
