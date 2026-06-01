'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { CameraCapture } from '@/components/exam/CameraCapture';
import { Progress } from '@/components/ui/Progress';
import { ShieldCheck, Video, Mic, Zap, CheckCircle2 } from 'lucide-react';
import styles from './page.module.css';

export default function VerifyPage() {
  const [step, setStep] = useState(1);
  const [checks, setChecks] = useState({
    camera: false,
    mic: false,
    speed: false
  });

  const runChecks = () => {
    // Mocking system checks
    setTimeout(() => setChecks(c => ({ ...c, camera: true })), 1000);
    setTimeout(() => setChecks(c => ({ ...c, mic: true })), 2000);
    setTimeout(() => {
      setChecks(c => ({ ...c, speed: true }));
      setStep(2);
    }, 3500);
  };

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>System Verification</h1>
          <p className={styles.subtitle}>Let's make sure everything is ready for your exam</p>
        </div>

        <div className={styles.content}>
          {step === 1 && (
            <div className={styles.checkList}>
              <div className={styles.checkItem}>
                <div className={styles.iconBox}><Video /></div>
                <div className={styles.checkDetails}>
                  <h3>Camera Check</h3>
                  <p>Webcam must be active for proctoring</p>
                </div>
                {checks.camera ? <CheckCircle2 className={styles.successIcon} /> : <div className={styles.dot} />}
              </div>
              <div className={styles.checkItem}>
                <div className={styles.iconBox}><Mic /></div>
                <div className={styles.checkDetails}>
                  <h3>Microphone Check</h3>
                  <p>Audio recording will be active</p>
                </div>
                {checks.mic ? <CheckCircle2 className={styles.successIcon} /> : <div className={styles.dot} />}
              </div>
              <div className={styles.checkItem}>
                <div className={styles.iconBox}><Zap /></div>
                <div className={styles.checkDetails}>
                  <h3>Internet Speed</h3>
                  <p>Minimum 2 Mbps stable connection</p>
                </div>
                {checks.speed ? <CheckCircle2 className={styles.successIcon} /> : <div className={styles.dot} />}
              </div>
              <Button onClick={runChecks} className={styles.runButton}>Run System Diagnostics</Button>
            </div>
          )}

          {step === 2 && (
            <div className={styles.captureGroup}>
              <CameraCapture label="Take Profile Photo" onCapture={(b) => console.log(b)} />
              <div style={{ height: '40px' }} />
              <Button onClick={() => setStep(3)} style={{ width: '100%' }}>Continue to ID Proof</Button>
            </div>
          )}

          {step === 3 && (
            <div className={styles.captureGroup}>
              <CameraCapture label="Capture ID Proof Document" onCapture={(b) => console.log(b)} />
              <div style={{ height: '40px' }} />
              <Button onClick={() => setStep(4)} style={{ width: '100%' }}>Final Rules</Button>
            </div>
          )}

          {step === 4 && (
            <div className={styles.rules}>
              <h3>Exam Rules & Regulations</h3>
              <ul className={styles.ruleList}>
                <li>Do not switch browser tabs or windows.</li>
                <li>Stay in full-screen mode throughout the exam.</li>
                <li>Ensure you are in a quiet, well-lit room.</li>
                <li>No other person should be visible in the camera.</li>
                <li>Calculators or mobile phones are strictly prohibited.</li>
              </ul>
              <div className={styles.acceptance}>
                <input type="checkbox" id="accept" />
                <label htmlFor="accept">I agree to the rules and understand that violations will lead to automatic submission.</label>
              </div>
              <Button onClick={() => window.location.href = '/exam/mock-id'} style={{ width: '100%' }}>Start Exam</Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
