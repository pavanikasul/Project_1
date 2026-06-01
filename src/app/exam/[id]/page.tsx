'use client';

import React, { useState, useEffect, useRef, use } from 'react';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { useProctoring } from '@/hooks/useProctoring';
import { Clock, AlertTriangle, User, Camera } from 'lucide-react';
import styles from './page.module.css';
import clsx from 'clsx';

import { QUESTION_BANK, EXAM_SECTIONS } from '@/data/exams';
import { supabase } from '@/lib/supabase';

export default function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  
  // States
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [examData, setExamData] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [reviewMarked, setReviewMarked] = useState<Record<string, boolean>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 60 minutes
  const [violationType, setViolationType] = useState<string | null>(null);
  const [warningToast, setWarningToast] = useState<{ type: string; count: number } | null>(null);
  const [warningCount, setWarningCount] = useState(0);
  const [violationLogs, setViolationLogs] = useState<any[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const lastViolationTimeRef = useRef(0);
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [submissionId, setSubmissionId] = useState<string | null>(null);

  const latestState = useRef({
    submissionId,
    warningCount,
    answers,
    examData,
    timeLeft,
    violationLogs,
    user
  });

  useEffect(() => {
    latestState.current = {
      submissionId,
      warningCount,
      answers,
      examData,
      timeLeft,
      violationLogs,
      user
    };
  });
  const [accessBlocked, setAccessBlocked] = useState(false);
  const [accessExpired, setAccessExpired] = useState(false);
  const [timeUntilExam, setTimeUntilExam] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);

  // Initialize Randomized Exam Data
  useEffect(() => {
    setMounted(true);

    // ── Time-Gate: Block early access & expiry ───────────────────────
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      let parsedUser = JSON.parse(savedUser);

      // ── Sync exam_slot from allCandidates (admin may have updated it) ──
      try {
        const allCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
        const match = allCandidates.find((c: any) =>
          c.email?.toLowerCase() === parsedUser.email?.toLowerCase() || c.id === parsedUser.id
        );
        if (match?.exam_slot && match.exam_slot !== parsedUser.exam_slot) {
          parsedUser = { ...parsedUser, exam_slot: match.exam_slot, status: match.status || parsedUser.status };
          localStorage.setItem('currentUser', JSON.stringify(parsedUser));
        }
      } catch (_) {}

      // ── Check for an active reschedule with 'New Slot Assigned' ──
      // This overrides the stale exam_slot when the admin has approved a reschedule
      let effectiveSlotTime: number | null = null;
      try {
        const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
        const newSlotRequest = localRequests
          .filter((r: any) =>
            (r.email === parsedUser.email || r.candidate_id === parsedUser.id) &&
            r.status === 'New Slot Assigned'
          )
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (newSlotRequest) {
          if (newSlotRequest.new_slot_time) {
            effectiveSlotTime = new Date(newSlotRequest.new_slot_time).getTime();
          } else if (newSlotRequest.preferred_date) {
            // Parse slot label e.g. "Afternoon (01:00 PM - 04:00 PM)"
            const slotMatch = (newSlotRequest.preferred_slot || '').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            let h = 0, m = 0;
            if (slotMatch) {
              h = parseInt(slotMatch[1], 10);
              m = parseInt(slotMatch[2], 10);
              if (slotMatch[3].toUpperCase() === 'PM' && h !== 12) h += 12;
              if (slotMatch[3].toUpperCase() === 'AM' && h === 12) h = 0;
            }
            const d = new Date(newSlotRequest.preferred_date);
            d.setHours(h, m, 0, 0);
            effectiveSlotTime = d.getTime();
          }
        }
      } catch (_) {}

      // Fall back to original exam_slot if no reschedule slot found
      if (!effectiveSlotTime && parsedUser.exam_slot) {
        effectiveSlotTime = new Date(parsedUser.exam_slot).getTime();
      }

      setUser(parsedUser);

      if (effectiveSlotTime) {
        const now = Date.now();
        const WINDOW_MS = 30 * 60 * 1000; // 30 minutes in ms

        if (now >= effectiveSlotTime + WINDOW_MS) {
          // Missed the 30-min window
          setAccessExpired(true);
          return; // Stop initialization
        }

        if (effectiveSlotTime > now) {
          // Not yet time — block access
          setAccessBlocked(true);
          const formatMs = (ms: number) => {
            const totalSec = Math.floor(ms / 1000);
            const h = Math.floor(totalSec / 3600);
            const m = Math.floor((totalSec % 3600) / 60);
            const s = totalSec % 60;
            return `${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;
          };
          setTimeUntilExam(formatMs(effectiveSlotTime - now));
          // Update countdown every second
          const ticker = setInterval(() => {
            const remaining = effectiveSlotTime! - Date.now();
            if (remaining <= 0) {
              clearInterval(ticker);
              setAccessBlocked(false);
            } else {
              setTimeUntilExam(formatMs(remaining));
            }
          }, 1000);
          return () => clearInterval(ticker);
        }
      }
      // Slot is active or no slot set — allow and initialize
      initializeSubmission(parsedUser);
    }
    // ────────────────────────────────────────────────────────────────

    const randomizedExam = EXAM_SECTIONS.map((section) => {
      const sectionName = section.title.split(': ')[1] || section.title;
      const allQuestions = [...(QUESTION_BANK[sectionName] || [])];
      
      // Robust Fisher-Yates shuffle for questions
      for (let i = allQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
      }

      // Pick 15 completely random, non-repeating questions per user
      const selected = allQuestions.slice(0, 15).map((q, idx) => {
        // Also apply Fisher-Yates to MCQ and MSQ options so no one gets the exact same layout
        let shuffledOptions = q.options ? [...q.options] : [];
        for (let i = shuffledOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
        }
        
        return {
          ...q,
          id: `${section.id}-q-${idx + 1}`,
          displayId: idx + 1,
          options: shuffledOptions
        };
      });

      return {
        ...section,
        questions: selected
      };
    });

    setExamData(randomizedExam);
  }, []);

  const initializeSubmission = async (u: any) => {
    // Set submissionId to the Candidate's ID immediately so Candidate ID, Registration ID and Submission ID are identical!
    if (u && u.id) {
      setSubmissionId(u.id);
    }

    try {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          candidate_id: u.id,
          status: 'ongoing',
          start_time: new Date().toISOString(),
          exam_data: { section: EXAM_SECTIONS[0].title }
        })
        .select()
        .single();
      
      // We keep our sequential ID for the application state so that Candidate ID, Registration ID, and Submission ID are matching
    } catch (err) {
      console.warn("Supabase init failed, using local mode");
    }
  };

  const handleViolation = (type: string) => {
    const now = Date.now();
    // 60 second cooldown for any violation
    if (lastViolationTimeRef.current !== 0 && now - lastViolationTimeRef.current < 60000) return;

    lastViolationTimeRef.current = now;
    const newLog = {
      type,
      timestamp: new Date().toLocaleTimeString(),
      details: type === 'Tab Switching' ? 'User left the exam tab' : 'AI Proctoring Alert'
    };

    setViolationLogs(prev => [...prev, newLog]);
    setWarningCount(prev => {
      const nextCount = prev + 1;

      if (nextCount >= 4) {
        // 4th violation — show full termination screen, auto-submit after 4s
        setViolationType(type);
        setTimeout(() => {
          handleSubmit(true);
        }, 4000);
      } else {
        // Warnings 1–3: show small non-blocking corner toast
        setWarningToast({ type, count: nextCount });
        // Auto-dismiss the toast after 6 seconds
        setTimeout(() => setWarningToast(null), 6000);
      }

      return nextCount;
    });

    const currentSubmissionId = latestState.current.submissionId;
    const currentUser = latestState.current.user;

    // Sync violation to Supabase (with graceful fallback if schema not migrated yet)
    if (currentSubmissionId) {
      supabase.from('violations').insert({
        submission_id: currentSubmissionId,
        type,
        timestamp: new Date().toISOString(),
        details: newLog.details
      }).then(({ error }) => {
        if (error) {
          // If 'details' column missing (schema not yet migrated), retry without it
          if (error.message?.includes('details')) {
            supabase.from('violations').insert({
              submission_id: currentSubmissionId,
              type,
              timestamp: new Date().toISOString()
            }).then(({ error: retryErr }) => {
              if (retryErr && !retryErr.message?.includes('uuid')) {
                console.warn('Violation sync skipped:', retryErr.message);
              }
            });
          } else if (!error.message?.includes('uuid')) {
            console.warn('Violation sync skipped:', error.message);
          }
        }
      });
    }

    // Local Storage Fallback for Admin Dashboard
    const existingViolations = JSON.parse(localStorage.getItem('allViolations') || '[]');
    existingViolations.push({
      id: `V-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      details: newLog.details,
      timestamp: new Date().toISOString(),
      submissions: {
        id: currentSubmissionId || `SUB-LOCAL`,
        profiles: {
          full_name: currentUser?.full_name || currentUser?.fullName || 'Anonymous'
        }
      }
    });
    localStorage.setItem('allViolations', JSON.stringify(existingViolations));
  };

  const { isFullscreen, requestFullscreen } = useProctoring(handleViolation);

  // Audio Monitoring Logic
  useEffect(() => {
    let animationFrame: number;
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkAudio = () => {
          analyser.getByteFrequencyData(dataArray);
          
          // Human voice fundamental frequencies usually fall between 300Hz and 3000Hz
          // With fftSize = 256 and sample rate ~44100Hz, each bin is ~172Hz
          // Bins 2 to 17 represent roughly 344Hz to 2924Hz (Voice Band)
          let voiceScore = 0;
          let voiceBinsCount = 0;
          for (let i = 2; i <= 17; i++) {
            voiceScore += dataArray[i];
            voiceBinsCount++;
          }
          
          const voiceAverage = voiceScore / voiceBinsCount;
          setAudioLevel(voiceAverage);
          
          // Only trigger violation if voice is distinctly and persistently loud (threshold: 150)
          if (voiceAverage > 150) {
            handleViolation('Human Voice/Speech Detected');
          }
          animationFrame = requestAnimationFrame(checkAudio);
        };
        checkAudio();
      })
      .catch(err => console.error("Audio error:", err));
    return () => cancelAnimationFrame(animationFrame);
  }, []);

  // Browser Tab Switching Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('Tab Switching / Browser Focus Lost');
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ── Camera + AI Proctoring: Mobile Detection / Eye Gaze / Head Rotation ──
  useEffect(() => {
    let stream: MediaStream | null = null;
    let animationFrame: number;
    let prevFrameData: Uint8ClampedArray | null = null;
    let motionAccum = 0;
    let motionFrameCount = 0;
    let phoneCheckCooldown = 0;
    let gazeCheckCooldown = 0;
    let headCheckCooldown = 0;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    const analyzeFrame = () => {
      const video = videoRef.current;
      if (!video || !ctx || video.readyState < 2) {
        animationFrame = requestAnimationFrame(analyzeFrame);
        return;
      }

      canvas.width = 160;
      canvas.height = 120;
      ctx.drawImage(video, 0, 0, 160, 120);
      const frame = ctx.getImageData(0, 0, 160, 120);
      const data = frame.data;

      // ── 1. MOBILE/PHONE SCREEN DETECTION ──────────────────────────────────
      // A phone screen in the camera appears as a very bright rectangular region.
      // We scan for a dense cluster of bright, blue-tinted pixels (typical screen glow).
      phoneCheckCooldown++;
      if (phoneCheckCooldown > 90) { // check every ~90 frames (~3s at 30fps)
        phoneCheckCooldown = 0;
        let brightPixels = 0;
        let screenlikePixels = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const brightness = (r + g + b) / 3;
          // Bright pixel
          if (brightness > 180) brightPixels++;
          // Screen-like: cool/blue-white light (phone/laptop screen color signature)
          if (brightness > 160 && b >= r - 10 && b >= g - 10) screenlikePixels++;
        }
        const totalPixels = (160 * 120);
        const brightRatio = brightPixels / totalPixels;
        const screenRatio = screenlikePixels / totalPixels;
        // If more than 8% of pixels are screen-like bright rectangles
        if (screenRatio > 0.08 && brightRatio > 0.05) {
          handleViolation('Mobile Device / External Screen Detected');
        }
      }

      // ── 2. HEAD ROTATION DETECTION ─────────────────────────────────────────
      // Detect large rapid motion in the frame (head turning away = large pixel diff)
      headCheckCooldown++;
      if (prevFrameData && headCheckCooldown > 15) { // check every ~15 frames
        headCheckCooldown = 0;
        let diffScore = 0;
        const sampleStep = 8; // sample every 8th pixel for performance
        let sampledCount = 0;
        for (let i = 0; i < data.length; i += 4 * sampleStep) {
          const dr = Math.abs(data[i] - prevFrameData[i]);
          const dg = Math.abs(data[i + 1] - prevFrameData[i + 1]);
          const db = Math.abs(data[i + 2] - prevFrameData[i + 2]);
          diffScore += (dr + dg + db) / 3;
          sampledCount++;
        }
        const avgMotion = diffScore / sampledCount;
        motionAccum += avgMotion;
        motionFrameCount++;

        if (motionFrameCount >= 10) {
          const avgOverWindow = motionAccum / motionFrameCount;
          // Large sustained motion = head turned significantly
          if (avgOverWindow > 55) {
            handleViolation('Head Rotation / Looking Away Detected');
          }
          motionAccum = 0;
          motionFrameCount = 0;
        }
      }

      // ── 3. EYE GAZE DETECTION ──────────────────────────────────────────────
      // Detect if the face center region (top-middle of frame) has gone dark.
      // When a person looks sharply away or ducks their head, the face region
      // brightness drops significantly from baseline.
      gazeCheckCooldown++;
      if (gazeCheckCooldown > 60) { // check every ~60 frames (~2s)
        gazeCheckCooldown = 0;
        // Sample the center-top 40x40 region (where face/eyes typically are)
        const faceX = 60, faceY = 10, faceW = 40, faceH = 40;
        let faceBrightness = 0;
        let facePixelCount = 0;
        for (let y = faceY; y < faceY + faceH; y++) {
          for (let x = faceX; x < faceX + faceW; x++) {
            const idx = (y * 160 + x) * 4;
            faceBrightness += (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
            facePixelCount++;
          }
        }
        const avgFaceBrightness = faceBrightness / facePixelCount;
        // If face zone is very dark, the person is not looking at the camera
        if (avgFaceBrightness < 30) {
          handleViolation('Eye Gaze / Face Not Visible Detected');
        }
      }

      // Store current frame for next motion comparison
      prevFrameData = new Uint8ClampedArray(data);
      animationFrame = requestAnimationFrame(analyzeFrame);
    };

    navigator.mediaDevices.getUserMedia({ video: true })
      .then(s => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
        animationFrame = requestAnimationFrame(analyzeFrame);
      })
      .catch(err => console.warn('Camera not available:', err));

    return () => {
      cancelAnimationFrame(animationFrame);
      stream?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Timer logic
  useEffect(() => {
    if (timeLeft <= 0) {
      handleSubmit(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  // Periodic Proctoring Status Update
  useEffect(() => {
    if (!submissionId) return;

    const interval = setInterval(async () => {
      try {
        const webcamActive = videoRef.current && videoRef.current.srcObject ? 'active' : 'inactive';
        const micActive = audioLevel > 5 ? 'active' : 'idle';
        const internetStatus = navigator.onLine ? 'online' : 'offline';

        // Local Storage Fallback Update for Admin Dashboard
        const liveExams = JSON.parse(localStorage.getItem('liveExams') || '{}');
        const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
        liveExams[submissionId || 'SUB-LOCAL'] = {
          id: submissionId || 'SUB-LOCAL',
          status: 'ongoing',
          start_time: user?.exam_slot || new Date().toISOString(),
          warning_count: warningCount,
          exam_data: {
            section: examData[activeSectionIdx]?.title || 'Aptitude Test',
            proctoring_status: {
              webcam: webcamActive,
              microphone: micActive,
              internet: internetStatus,
              remaining_time: timeLeft,
              last_updated: new Date().toISOString()
            }
          },
          profiles: {
            full_name: user?.full_name || user?.fullName || 'Anonymous Candidate',
            email: user?.email,
            mobile: user?.mobile,
            id_proof_type: user?.id_proof_type || user?.idType,
            id_proof_number: user?.id_proof_number || user?.idNumber
          }
        };
        localStorage.setItem('liveExams', JSON.stringify(liveExams));

        await supabase
          .from('submissions')
          .update({
            exam_data: {
              section: examData[activeSectionIdx]?.title || 'Aptitude Test',
              proctoring_status: {
                webcam: webcamActive,
                microphone: micActive,
                internet: internetStatus,
                remaining_time: timeLeft,
                last_updated: new Date().toISOString()
              }
            }
          })
          .eq('id', submissionId);
      } catch (err) {
        console.warn("Proctoring sync failed:", err);
      }
    }, 10000); // every 10 seconds

    return () => clearInterval(interval);
  }, [submissionId, timeLeft, activeSectionIdx, examData, audioLevel]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSubmit = async (isAuto = false) => {
    const { answers, examData, timeLeft, warningCount, violationLogs, user, submissionId } = latestState.current;
    const finalResult = {
      answers,
      examData,
      timeLeft,
      violations: warningCount,
      violationLogs,
      isAutoSubmission: isAuto,
      submittedAt: new Date().toISOString(),
      // Identity fields so the dashboard can verify ownership
      candidateId: user?.id || submissionId || null,
      candidateEmail: user?.email || null,
      candidateName: user?.full_name || user?.fullName || null,
    };

    // Save results for result page
    localStorage.setItem('examResult', JSON.stringify(finalResult));

    // Fallback: Save to allSubmissions for Admin Dashboard
    const existingSubmissions = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
    existingSubmissions.push({
      id: submissionId || `SUB-${Date.now()}`,
      status: 'submitted',
      start_time: new Date(Date.now() - (3600 - timeLeft) * 1000).toISOString(),
      end_time: new Date().toISOString(),
      score_data: finalResult,
      profiles: {
        full_name: user?.full_name || user?.fullName || 'Anonymous',
        email: user?.email || ''
      }
    });
    localStorage.setItem('allSubmissions', JSON.stringify(existingSubmissions));

    // Sync to Supabase
    if (submissionId) {
      await supabase.from('submissions').update({
        status: 'submitted',
        end_time: new Date().toISOString(),
        score_data: finalResult,
        warning_count: warningCount
      }).eq('id', submissionId);
    }

    window.location.href = '/result';
  };

  if (!mounted) return null;

  // ── Show blocked screen if slot hasn't arrived ──
  if (accessBlocked) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A3557 0%, #0d3d6b 100%)',
        fontFamily: 'inherit'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '48px 40px',
          maxWidth: '480px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.4)'
        }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto',
            fontSize: '28px'
          }}>🔒</div>
          <h2 style={{ margin: '0 0 8px 0', color: '#0A3557', fontSize: '1.4rem', fontWeight: 800 }}>
            Exam Not Yet Accessible
          </h2>
          <p style={{ color: '#64748b', margin: '0 0 28px 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
            Your exam is scheduled for a future time. You cannot access the exam until your slot begins.
          </p>

          {/* Live Countdown */}
          <div style={{
            background: '#f8fafc',
            border: '2px solid #e2e8f0',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>Time Until Your Exam</p>
            <p style={{ margin: 0, fontSize: '2.2rem', fontWeight: 800, fontFamily: 'monospace', color: '#008F8C', letterSpacing: '2px' }}>
              {timeUntilExam}
            </p>
          </div>

          {user?.exam_slot && (
            <p style={{ margin: '0 0 28px 0', fontSize: '0.85rem', color: '#475569' }}>
              <strong>Your Scheduled Slot:</strong><br />
              {new Date(user.exam_slot).toLocaleString('en-IN', {
                weekday: 'long', year: 'numeric', month: 'long',
                day: 'numeric', hour: '2-digit', minute: '2-digit'
              })}
            </p>
          )}

          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: 'linear-gradient(135deg, #0A3557, #008F8C)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Show expired screen if slot window missed ──
  if (accessExpired) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 100%)',
        fontFamily: 'inherit'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '48px 40px',
          maxWidth: '480px',
          width: '90%',
          textAlign: 'center',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)'
        }}>
          <div style={{
            width: '64px', height: '64px',
            background: 'linear-gradient(135deg, #fecaca, #fca5a5)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px auto',
            fontSize: '28px'
          }}>🔒</div>
          <h2 style={{ margin: '0 0 8px 0', color: '#7f1d1d', fontSize: '1.4rem', fontWeight: 800 }}>
            Exam Access Expired
          </h2>
          <p style={{ color: '#475569', margin: '0 0 28px 0', fontSize: '0.95rem', lineHeight: 1.6 }}>
            You did not start the exam within the <strong>30-minute window</strong> after your scheduled slot. 
            Your access has been permanently revoked.
          </p>

          {user?.exam_slot && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '28px',
              fontSize: '0.85rem',
              color: '#991b1b',
              textAlign: 'left'
            }}>
              <div style={{ marginBottom: '8px' }}>
                <strong>📅 Scheduled Slot:</strong><br />
                {new Date(user.exam_slot).toLocaleString('en-IN', {
                  weekday: 'long', year: 'numeric', month: 'long',
                  day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
              <div>
                <strong>⏰ Deadline to Start:</strong><br />
                {new Date(new Date(user.exam_slot).getTime() + 30 * 60 * 1000).toLocaleString('en-IN', {
                  weekday: 'long', year: 'numeric', month: 'long',
                  day: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </div>
            </div>
          )}

          <button
            onClick={() => window.location.href = '/dashboard'}
            style={{
              background: 'linear-gradient(135deg, #991b1b, #7f1d1d)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 28px',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: 'pointer',
              width: '100%'
            }}
          >
            ← Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (examData.length === 0) return null;

  const currentSection = examData[activeSectionIdx];
  const currentQuestion = currentSection.questions[currentIdx];
  
  const totalQuestions = 60;
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / totalQuestions) * 100;

  const handleSectionSwitch = (idx: number) => {
    setActiveSectionIdx(idx);
    setCurrentIdx(0);
  };

  const handleAnswerToggle = (questionId: string, option: string) => {
    const currentAnswer = answers[questionId] || [];
    if (Array.isArray(currentAnswer)) {
      if (currentAnswer.includes(option)) {
        setAnswers({ ...answers, [questionId]: currentAnswer.filter(a => a !== option) });
      } else {
        setAnswers({ ...answers, [questionId]: [...currentAnswer, option] });
      }
    } else {
      setAnswers({ ...answers, [questionId]: [option] });
    }
  };

  const toggleReview = (questionId: string) => {
    setReviewMarked(prev => ({ ...prev, [questionId]: !prev[questionId] }));
  };

  const getQuestionStatus = (qId: string) => {
    if (reviewMarked[qId]) return 'review';
    if (answers[qId] && (typeof answers[qId] === 'string' ? answers[qId].trim() !== '' : answers[qId].length > 0)) return 'read';
    return 'unread';
  };

  return (
    <div className={styles.layout}>
      {/* ── Corner Warning Toast (warnings 1-3, non-blocking) ── */}
      {warningToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '24px',
          zIndex: 9999,
          background: warningToast.count === 3 ? '#7f1d1d' : '#1e3a5f',
          color: '#fff',
          borderRadius: '12px',
          padding: '16px 20px',
          maxWidth: '340px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          borderLeft: `4px solid ${warningToast.count === 3 ? '#ef4444' : '#f59e0b'}`,
          animation: 'slideIn 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {warningToast.count === 3 ? '🚨' : '⚠️'} Warning {warningToast.count} of 3
            </span>
            <button
              onClick={() => setWarningToast(null)}
              style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1 }}
            >✕</button>
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#fde68a' }}>{warningToast.type}</span>
          <span style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
            {warningToast.count === 3
              ? '🚨 Final warning! Next violation will terminate your exam.'
              : `${3 - warningToast.count} warning(s) remaining before exam termination.`}
          </span>
        </div>
      )}

      {/* ── Full-Screen Termination Block (4th violation only) ── */}
      {violationType && (
        <div className={styles.violationOverlay}>
          <div className={styles.violationCard}>
            <AlertTriangle className={styles.warningIcon} />
            <h2 style={{ color: '#dc2626' }}>Exam Terminated</h2>
            <p style={{ margin: '20px 0', fontSize: '1.1rem' }}>
              <strong>{violationType}</strong>
            </p>
            <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>
              You have exceeded the maximum of 3 warnings. Your exam is being automatically submitted.
            </p>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.timer}>
            <Clock size={20} />
            <span>{formatTime(timeLeft)}</span>
          </div>
          <div className={styles.sectionTabs}>
            {examData.map((section, idx) => (
              <button
                key={section.id}
                className={clsx(styles.sectionTab, activeSectionIdx === idx && styles.activeSectionTab)}
                onClick={() => handleSectionSwitch(idx)}
              >
                Section {idx + 1}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.progressContainer}>
          <Progress value={progress} />
          <div className={styles.headerStats}>
            <span className={clsx(styles.warningBadge, warningCount > 0 && styles.warningActive)}>
              Warnings: {warningCount}/3
            </span>
            <span className={styles.progressText}>{answeredCount}/{totalQuestions} Answered</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => handleSubmit(false)}>Finish Exam</Button>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <div className={styles.webcamBox}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
            <div className={styles.webcamLabel}>
              <div className={styles.livePulse} />
              AI PROCTORING ACTIVE
            </div>
            
            <div className={styles.micStatus}>
              <div className={styles.micIcon}>
                <div className={styles.micWave} style={{ height: `${Math.min(audioLevel * 2, 100)}%` }} />
              </div>
              <span>MONITORING AUDIO</span>
            </div>
          </div>
          
          <div className={styles.navSection}>
            <div className={styles.navHeader}>
              <h3 className={styles.navTitle}>Questions</h3>
              <div className={styles.statusLegend}>
                <div className={styles.legendItem}><span className={clsx(styles.dot, styles.dotRead)} /> Read</div>
                <div className={styles.legendItem}><span className={clsx(styles.dot, styles.dotUnread)} /> Unread</div>
                <div className={styles.legendItem}><span className={clsx(styles.dot, styles.dotReview)} /> Review</div>
              </div>
            </div>
            
            <div className={styles.questionGrid}>
              {currentSection.questions.map((q: any, i: number) => {
                const status = getQuestionStatus(q.id);
                return (
                  <button 
                    key={q.id}
                    className={clsx(
                      styles.navBtn, 
                      currentIdx === i && styles.navBtnActive,
                      status === 'read' && styles.navBtnRead,
                      status === 'unread' && styles.navBtnUnread,
                      status === 'review' && styles.navBtnReview
                    )}
                    onClick={() => setCurrentIdx(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.violationSummary}>
            <h4 className={styles.summaryTitle}>Security Logs</h4>
            <div className={styles.logList}>
              {violationLogs.length === 0 ? (
                <p className={styles.emptyLogs}>No violations recorded</p>
              ) : (
                violationLogs.map((log, idx) => (
                  <div key={idx} className={styles.logEntry}>
                    <span className={styles.logTime}>{log.timestamp}</span>
                    <span className={styles.logType}>{log.type}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ background: 'white', padding: '15px', borderRadius: 'var(--radius-md)', border: '2px solid var(--border)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>CANDIDATE</p>
            <p style={{ fontWeight: 700 }}>{user?.fullName || 'Registered Student'}</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>ID: {user?.id || 'AE-2024-001'}</p>
          </div>
        </aside>

        <main className={styles.examArea}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.activeSectionTitle}>{currentSection.title}</h2>
          </div>
          
          <div className={styles.questionCard}>
            <div className={styles.questionHeaderRow}>
              <p style={{ color: 'var(--secondary)', fontWeight: 700 }}>
                QUESTION {currentIdx + 1} OF {currentSection.questions.length}
              </p>
              <button 
                className={clsx(styles.reviewBtn, reviewMarked[currentQuestion.id] && styles.reviewBtnActive)}
                onClick={() => toggleReview(currentQuestion.id)}
              >
                <Clock size={16} />
                {reviewMarked[currentQuestion.id] ? 'Marked for Review' : 'Mark for Review'}
              </button>
            </div>
            <div className={styles.typeBadge}>
              {currentQuestion.type === 'MCQ' && 'SINGLE CHOICE'}
              {currentQuestion.type === 'MSQ' && 'MULTIPLE SELECT (Select all that apply)'}
              {currentQuestion.type === 'TF' && 'TRUE / FALSE'}
              {currentQuestion.type === 'FIB' && 'FILL IN THE BLANK'}
            </div>
            <h2 className={styles.questionText}>{currentQuestion.text}</h2>
            
            <div className={styles.optionsGrid}>
              {currentQuestion.type === 'MCQ' && currentQuestion.options.map((opt: string) => (
                <button 
                  key={opt} 
                  className={clsx(styles.option, answers[currentQuestion.id] === opt && styles.optionSelected)}
                  onClick={() => setAnswers({...answers, [currentQuestion.id]: opt})}
                >
                  <div className={styles.radioCircle} />
                  {opt}
                </button>
              ))}

              {currentQuestion.type === 'MSQ' && currentQuestion.options.map((opt: string) => (
                <button 
                  key={opt} 
                  className={clsx(styles.option, answers[currentQuestion.id]?.includes?.(opt) && styles.optionSelected)}
                  onClick={() => handleAnswerToggle(currentQuestion.id, opt)}
                >
                  <div className={styles.checkSquare} />
                  {opt}
                </button>
              ))}

              {currentQuestion.type === 'TF' && currentQuestion.options.map((opt: string) => (
                <button 
                  key={opt} 
                  className={clsx(styles.option, answers[currentQuestion.id] === opt && styles.optionSelected)}
                  onClick={() => setAnswers({...answers, [currentQuestion.id]: opt})}
                >
                  {opt}
                </button>
              ))}

              {currentQuestion.type === 'FIB' && (
                <div className={styles.fibWrapper}>
                  <input 
                    type="text" 
                    className={styles.fibInput}
                    placeholder="Type your answer here..."
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => setAnswers({...answers, [currentQuestion.id]: e.target.value})}
                  />
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Button 
            variant="outline" 
            onClick={() => {
              if (currentIdx > 0) {
                setCurrentIdx(currentIdx - 1);
              } else if (activeSectionIdx > 0) {
                handleSectionSwitch(activeSectionIdx - 1);
                setCurrentIdx(14);
              }
            }}
            disabled={currentIdx === 0 && activeSectionIdx === 0}
          >
            Previous
          </Button>
          <Button 
            onClick={() => {
              if (currentIdx < currentSection.questions.length - 1) {
                setCurrentIdx(currentIdx + 1);
              } else if (activeSectionIdx < examData.length - 1) {
                handleSectionSwitch(activeSectionIdx + 1);
              }
            }}
            disabled={currentIdx === 14 && activeSectionIdx === 3}
          >
            {currentIdx === 14 && activeSectionIdx === 3 ? 'Review All' : 'Next Question'}
          </Button>
        </div>
      </footer>
    </div>
  );
}
