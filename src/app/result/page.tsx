'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Trophy, AlertCircle, CheckCircle, Home, BarChart } from 'lucide-react';
import styles from './page.module.css';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ResultPage() {
  const [randomQuote, setRandomQuote] = useState("");
  const [isTerminated, setIsTerminated] = useState(false);

  const quotes = [
    "The best way to predict the future is to create it.",
    "Believe you can and you're halfway there.",
    "Your talent determines what you can do. Your motivation determines how much you are willing to do.",
    "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    "The only way to do great work is to love what you do."
  ];

  useEffect(() => {
    setRandomQuote(quotes[Math.floor(Math.random() * quotes.length)]);
    try {
      const resultData = JSON.parse(localStorage.getItem('examResult') || '{}');
      if (resultData.violations >= 4) {
        setIsTerminated(true);
      }

      // Calculate score
      const examData = resultData.examData || [];
      const answers = resultData.answers || {};

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

      // Background Sync: Recover scores that failed to upload to Supabase previously
      const syncToSupabase = async () => {
        const currentUserStr = localStorage.getItem('currentUser');
        if (!currentUserStr) return;
        
        try {
          const user = JSON.parse(currentUserStr);
          if (user && user.id) {
            const submissionId = user.id;
            
            // Check if it already successfully synced
            const { data: existingSub } = await supabase
              .from('submissions')
              .select('id, status')
              .eq('id', submissionId)
              .single();

            if (!existingSub || existingSub.status !== 'submitted') {
              // Data is trapped in localStorage! Let's upload it now.
              const endTime = resultData.submittedAt || new Date().toISOString();
              const startTime = new Date(new Date(endTime).getTime() - (3600 - (resultData.timeLeft || 0)) * 1000).toISOString();
              
              const payload = {
                id: submissionId,
                candidate_id: submissionId,
                status: 'submitted',
                start_time: startTime,
                end_time: endTime,
                score_data: resultData,
                warning_count: resultData.violations || 0
              };

              if (existingSub) {
                await supabase.from('submissions').update(payload).eq('id', submissionId);
              } else {
                await supabase.from('submissions').insert(payload);
              }
              console.log("Background sync successful!");
            }
          }
        } catch (syncErr) {
          console.warn("Background sync skipped:", syncErr);
        }
      };

      syncToSupabase();

    } catch (e) {}
  }, []);

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.trophySection}>
          <div className={styles.trophyCircle} style={isTerminated ? { background: '#fef2f2' } : {}}>
            {isTerminated ? (
              <AlertCircle size={80} color="#dc2626" />
            ) : (
              <CheckCircle size={80} className={styles.successIcon} />
            )}
          </div>
          <h1 className={styles.title} style={isTerminated ? { color: '#dc2626' } : {}}>
            {isTerminated ? 'Exam Terminated' : 'Submission Received!'}
          </h1>
          <p className={styles.subtitle}>
            {isTerminated 
              ? 'Your examination was automatically submitted due to exceeding the maximum allowed violations.' 
              : 'Your examination has been securely transmitted to the evaluation center.'}
          </p>
        </div>

        <div className={styles.quoteCard}>
          <p className={styles.quoteText}>"{randomQuote}"</p>
          <span className={styles.quoteAuthor}>— Inspirational Wisdom</span>
        </div>

        <div className={styles.messageCard}>
          <p>Thank you for your effort today. Our HR coordinators will review your performance and proctoring logs. You will be notified of the official result via your registered email.</p>
        </div>

        <div className={styles.actions}>
          <Link href="/" style={{ width: '100%' }}>
            <Button variant="outline" style={{ width: '100%' }}>
              <Home size={18} style={{ marginRight: '8px' }} /> Return to Home
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
