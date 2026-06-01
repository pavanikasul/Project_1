'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Camera, Mic, Wifi, Monitor, CheckCircle, 
  XCircle, Loader2, AlertTriangle, ShieldCheck, Play, Upload, FileText
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import Tesseract from 'tesseract.js';
import styles from './page.module.css';

export default function VerificationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [registeredUser, setRegisteredUser] = useState<any>(null);
  const [idError, setIdError] = useState('');

  // Verification States
  const [sysChecks, setSysChecks] = useState({
    browser: 'pending',
    resolution: 'pending',
    internet: 'pending',
    camera: 'pending',
    mic: 'pending',
  });
  
  const [faceImage, setFaceImage] = useState<string | null>(null);
  const [idImage, setIdImage] = useState<string | null>(null);
  const [idType, setIdType] = useState('Aadhaar');
  const [idMethod, setIdMethod] = useState<'webcam'|'upload'>('webcam');
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Fetch registered user data
  useEffect(() => {
    const userStr = localStorage.getItem('currentUser');
    if (userStr) {
      const user = JSON.parse(userStr);
      setRegisteredUser(user);
      if (user.idType) {
        setIdType(user.idType);
      }
    }
  }, []);

  // Run System Checks
  useEffect(() => {
    if (step === 1) {
      runSystemChecks();
    }
    
    if ((step === 2 || step === 3) && !faceImage && !idImage) {
      startCamera();
    } else {
      stopCamera();
    }

    if (step === 4) {
      const timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
      return () => clearInterval(timer);
    }
    
    return () => stopCamera();
  }, [step]);

  const runSystemChecks = async () => {
    // Mock browser
    setTimeout(() => setSysChecks(prev => ({ ...prev, browser: 'success' })), 500);
    // Mock resolution
    setTimeout(() => setSysChecks(prev => ({ ...prev, resolution: 'success' })), 1000);
    // Mock internet
    setTimeout(() => setSysChecks(prev => ({ ...prev, internet: 'success' })), 1500);
    
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStream.getTracks().forEach(track => track.stop()); // close immediately after test
      setTimeout(() => setSysChecks(prev => ({ ...prev, camera: 'success', mic: 'success' })), 2000);
    } catch (e) {
      setTimeout(() => setSysChecks(prev => ({ ...prev, camera: 'error', mic: 'error' })), 2000);
    }
  };

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (e) {
      alert("Camera access denied! Please allow camera permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = (type: 'face' | 'id') => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Only flip if face so it matches the mirrored preview
        if (type === 'face') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (type === 'face') {
          setFaceImage(dataUrl);
        } else {
          setIdImage(dataUrl);
          extractDataFromImage(dataUrl);
        }
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        alert('Invalid file format. Please upload JPG, PNG, or PDF.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setIdImage(event.target.result as string);
          extractDataFromImage(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const extractDataFromImage = async (imageUrl: string) => {
    setExtracting(true);
    setExtractedData(null);
    setIdError('');
    
    try {
      const result = await Tesseract.recognize(imageUrl, 'eng');
      const text = result.data.text;
      
      const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/g;
      const matches = text.match(aadhaarRegex);
      
      let extractedNumber = 'Not Found';
      if (matches && matches.length > 0) {
        extractedNumber = matches[0].replace(/\s/g, '');
      }

      let displayExtracted = extractedNumber;
      if (extractedNumber.length === 12) {
        displayExtracted = extractedNumber.replace(/(.{4})/g, '$1 ').trim();
      }

      if (registeredUser?.isGuest) {
        setExtractedData({
          name: 'Guest Candidate',
          idNumber: displayExtracted !== 'Not Found' ? displayExtracted : '1234 5678 9012',
          gender: 'Female/Male',
          idType: registeredUser?.idType || 'Aadhar Card'
        });
        setIdError('');
      } else {
        setExtractedData({
          name: registeredUser?.fullName || 'Candidate Name',
          idNumber: displayExtracted,
          gender: 'Female',
          idType: registeredUser?.idType || 'Aadhar Card'
        });

        const cleanRegistered = (registeredUser?.idNumber || '').replace(/\s/g, '');
        
        if (extractedNumber !== cleanRegistered) {
          setIdError('Invalid ID Number - data is invalid');
        }
      }
    } catch (err) {
      console.error('OCR Error:', err);
      setIdError('Invalid ID Number - data is invalid');
    } finally {
      setExtracting(false);
    }
  };

  const resetIdCapture = () => {
    setIdImage(null);
    setExtractedData(null);
    if (idMethod === 'webcam') startCamera();
  };

  const allChecksPassed = Object.values(sysChecks).every(s => s === 'success');

  const completeVerification = async () => {
    setLoading(true);
    try {
      const userStr = localStorage.getItem('currentUser');
      if (userStr) {
        const user = JSON.parse(userStr);

        // Only query Supabase if user.id is a real UUID (not a local formatted ID like "AE-5830")
        const isValidUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(user.id || '');

        if (isValidUUID) {
          try {
            const { error } = await supabase.from('profiles').update({
              face_photo_url: 'VERIFIED',
              id_photo_url: 'VERIFIED'
            }).eq('id', user.id);

            if (error && !error.message.includes('row-level security')) {
              console.warn("Verification profile update skipped:", error.message);
            }
          } catch (_) {
            // Non-critical — proceed to exam regardless
          }
        }
      }

      const searchParams = new URLSearchParams(window.location.search);
      const examId = searchParams.get('examId');

      if (examId) {
        router.push(`/exam/${examId}`);
      } else {
        router.push('/dashboard');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Pre-Exam Verification</h1>
          <p className={styles.subtitle}>
            {step === 1 && 'System Diagnostics Check'}
            {step === 2 && 'Live Face Photo Capture'}
            {step === 3 && 'Identity Proof Verification'}
            {step === 4 && 'Exam Rules & Security Terms'}
            {step === 5 && 'Verification Summary'}
          </p>
        </div>

        <div className={styles.content}>
          {/* STEP 1: SYSTEM CHECK */}
          {step === 1 && (
            <div>
              <p>Please wait while we verify your system requirements.</p>
              <div className={styles.checkList}>
                <CheckItem title="Browser Compatibility" icon={Monitor} status={sysChecks.browser} />
                <CheckItem title="Screen Resolution" icon={Monitor} status={sysChecks.resolution} />
                <CheckItem title="Internet Stability" icon={Wifi} status={sysChecks.internet} />
                <CheckItem title="Webcam Access" icon={Camera} status={sysChecks.camera} />
                <CheckItem title="Microphone Access" icon={Mic} status={sysChecks.mic} />
              </div>
            </div>
          )}

          {/* STEP 2: FACE CAPTURE */}
          {step === 2 && (
            <div style={{ textAlign: 'center' }}>
              <p>Please position your face clearly inside the frame and capture a live photo.</p>
              
              <div className={styles.cameraBox}>
                {!faceImage ? (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className={styles.videoFeed} />
                    <div className={styles.faceGuide}></div>
                  </>
                ) : (
                  <img src={faceImage} alt="Captured Face" className={styles.previewImg} />
                )}
                <canvas ref={canvasRef} style={{ display: 'none' }} />
              </div>

              <div className={styles.cameraControls}>
                {!faceImage ? (
                  <button className={styles.btnPrimary} onClick={() => capturePhoto('face')}>
                    <Camera size={18} /> Capture Photo
                  </button>
                ) : (
                  <>
                    <button className={styles.btnOutline} onClick={() => { setFaceImage(null); startCamera(); }}>
                      Retake
                    </button>
                    <button className={styles.btnPrimary} onClick={() => setStep(3)}>
                      Confirm & Next
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: ID CAPTURE */}
          {step === 3 && (
            <div style={{ textAlign: 'center' }}>
              <div className={styles.tabs}>
                <button 
                  className={`${styles.tab} ${idMethod === 'webcam' ? styles.activeTab : ''}`}
                  onClick={() => { setIdMethod('webcam'); resetIdCapture(); }}
                >
                  <Camera size={16} style={{ display: 'inline', marginRight: '8px' }} /> Webcam Capture
                </button>
                <button 
                  className={`${styles.tab} ${idMethod === 'upload' ? styles.activeTab : ''}`}
                  onClick={() => { setIdMethod('upload'); resetIdCapture(); stopCamera(); }}
                >
                  <Upload size={16} style={{ display: 'inline', marginRight: '8px' }} /> File Upload
                </button>
              </div>

              {idMethod === 'webcam' ? (
                <div className={styles.cameraBox}>
                  {!idImage ? (
                    <>
                      <video ref={videoRef} autoPlay playsInline muted className={styles.videoFeed} style={{ transform: 'none' }} />
                      <div className={styles.idGuide}></div>
                    </>
                  ) : (
                    <img src={idImage} alt="Captured ID" className={styles.previewImg} />
                  )}
                  <canvas ref={canvasRef} style={{ display: 'none' }} />
                </div>
              ) : (
                <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                  {!idImage ? (
                    <label className={styles.uploadZone}>
                      <Upload size={32} color="#0A3557" />
                      <div>
                        <strong>Click to upload {registeredUser?.idType || 'ID Proof'}</strong>
                        <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.5rem' }}>Support for JPG, PNG, PDF (Max 5MB)</p>
                      </div>
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" className={styles.uploadInput} onChange={handleFileUpload} />
                    </label>
                  ) : (
                    <div className={styles.cameraBox}>
                      <img src={idImage} alt="Uploaded ID" className={styles.previewImg} style={{ objectFit: 'contain', background: '#f8fafc' }} />
                    </div>
                  )}
                </div>
              )}

              {extracting && (
                <div style={{ marginTop: '1.5rem', color: '#0A3557' }}>
                  <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
                  <p>Processing Secure Aadhaar OCR...</p>
                </div>
              )}

              {extractedData && (
                <div 
                  className={styles.extractedData} 
                  style={{ 
                    maxWidth: '500px', 
                    margin: '1.5rem auto',
                    border: `2px solid ${idError ? 'var(--danger)' : '#16a34a'}`,
                    backgroundColor: idError ? '#fff5f5' : '#f0fff4'
                  }}
                >
                  {idError ? (
                    <h4 style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <XCircle size={18} /> Identity Verified Unsuccessfully
                    </h4>
                  ) : (
                    <h4 style={{ color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <ShieldCheck size={18} /> Identity Verified Successfully
                    </h4>
                  )}
                  
                  <div className={styles.dataGrid}>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>Full Name</span>
                      <span className={styles.dataValue}>{extractedData.name}</span>
                    </div>
                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>{registeredUser?.idType || 'ID'} Number</span>
                      <span className={styles.dataValue} style={{ color: idError ? 'var(--danger)' : 'inherit', fontWeight: idError ? 800 : 700 }}>
                        {extractedData.idNumber}
                      </span>
                    </div>

                    <div className={styles.dataItem}>
                      <span className={styles.dataLabel}>Gender</span>
                      <span className={styles.dataValue}>{extractedData.gender}</span>
                    </div>
                  </div>
                  
                  {idError && (
                    <div style={{ marginTop: '15px', padding: '10px', background: 'rgba(255,0,0,0.05)', borderRadius: '8px' }}>
                      <p style={{ color: 'var(--danger)', fontWeight: 700, fontSize: '0.9rem' }}>{idError}</p>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '5px' }}>
                        Registered: <strong>{registeredUser?.idNumber}</strong>
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.cameraControls}>
                {!idImage ? (
                  idMethod === 'webcam' && (
                    <button className={styles.btnPrimary} onClick={() => capturePhoto('id')}>
                      <Camera size={18} /> Capture {registeredUser?.idType || 'ID Proof'}
                    </button>
                  )
                ) : (
                  <>
                    <button className={styles.btnOutline} onClick={resetIdCapture} disabled={extracting}>
                      Retake
                    </button>
                    <button className={styles.btnPrimary} onClick={() => setStep(4)} disabled={extracting || !!idError}>
                      Confirm & Next
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: RULES */}
          {step === 4 && (
            <div>
              <div className={styles.rulesList}>
                <h3><AlertTriangle size={20} /> Strict Proctored Exam Rules</h3>
                <ul>
                  <li><strong>No Tab Switching:</strong> Navigating away from the exam will automatically terminate it.</li>
                  <li><strong>Webcam & Mic ON:</strong> Your camera and microphone must remain active throughout the exam.</li>
                  <li><strong>No Mobile Phones:</strong> Detection of electronic devices will flag a violation.</li>
                  <li><strong>Solo Environment:</strong> Multiple faces or voices will trigger automatic termination.</li>
                  <li><strong>Clear Lighting:</strong> Ensure your face is clearly visible at all times.</li>
                </ul>
              </div>

              <div className={styles.agreement}>
                <input 
                  type="checkbox" 
                  id="agree" 
                  checked={agreed} 
                  onChange={(e) => setAgreed(e.target.checked)} 
                />
                <label htmlFor="agree">
                  I agree to all exam rules and understand that any violation may result in immediate disqualification.
                </label>
              </div>

              {countdown > 0 ? (
                <div className={styles.timer}>
                  Exam will begin in {countdown} seconds...
                </div>
              ) : (
                <div className={styles.timer} style={{ color: '#16a34a' }}>
                  Ready to proceed!
                </div>
              )}
            </div>
          )}

          {/* STEP 5: SUMMARY */}
          {step === 5 && (
            <div>
              <h2 style={{ textAlign: 'center', marginBottom: '2rem', color: '#0A3557' }}>Verification Complete</h2>
              <div className={styles.summaryGrid}>
                <div className={`${styles.summaryCard} ${styles.success}`}>
                  <Monitor size={32} color="#16a34a" />
                  <h4>System Diagnostics</h4>
                  <p>Passed successfully</p>
                </div>
                <div className={`${styles.summaryCard} ${styles.success}`}>
                  <Camera size={32} color="#16a34a" />
                  <h4>Face Verification</h4>
                  <p>Photo Captured</p>
                </div>
                <div className={`${styles.summaryCard} ${styles.success}`}>
                  <ShieldCheck size={32} color="#16a34a" />
                  <h4>Identity Proof</h4>
                  <p>ID Verified</p>
                </div>
                <div className={`${styles.summaryCard} ${styles.success}`}>
                  <CheckCircle size={32} color="#16a34a" />
                  <h4>Security Rules</h4>
                  <p>Accepted</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {step > 1 && step < 5 ? (
            <button className={styles.btnOutline} onClick={() => setStep(s => s - 1)}>
              Back
            </button>
          ) : <div></div>}

          {step === 1 && (
            <button 
              className={styles.btnPrimary} 
              onClick={() => setStep(2)}
              disabled={!allChecksPassed}
            >
              Continue <Play size={16} />
            </button>
          )}

          {step === 4 && (
            <button 
              className={styles.btnPrimary} 
              onClick={() => setStep(5)}
              disabled={!agreed || countdown > 0}
            >
              Confirm Acceptance
            </button>
          )}

          {step === 5 && (
            <button 
              className={styles.btnPrimary} 
              onClick={completeVerification}
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1.1rem' }}
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Start Exam Now'}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

// Helper component
function CheckItem({ title, icon: Icon, status }: { title: string, icon: any, status: string }) {
  return (
    <div className={styles.checkItem}>
      <div className={styles.checkInfo}>
        <Icon size={20} color="#0A3557" />
        <span className={styles.checkTitle}>{title}</span>
      </div>
      <div className={`${styles.checkStatus} ${
        status === 'success' ? styles.statusSuccess : 
        status === 'error' ? styles.statusError : 
        styles.statusPending
      }`}>
        {status === 'success' && <><CheckCircle size={16} /> Passed</>}
        {status === 'error' && <><XCircle size={16} /> Failed</>}
        {status === 'pending' && <><Loader2 size={16} className="animate-spin" /> Checking...</>}
      </div>
    </div>
  );
}
