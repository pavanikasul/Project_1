'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Download, Award, BarChart2, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../table.module.css';

export default function ScoresPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [scores, setScores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingScore, setEditingScore] = useState<any | null>(null);
  const [editSForm, setEditSForm] = useState({
    correctAnswers: 0,
    totalQuestions: 10,
    status: 'submitted'
  });

  const getCandidateApxId = (scoreItem: any) => {
    let candidateId = scoreItem.candidate_id || scoreItem.id;
    const email = scoreItem.profiles?.email;
    const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
    
    if (email) {
      const candidate = localCandidates.find((c: any) => c.email?.toLowerCase() === email.toLowerCase());
      if (candidate && candidate.id) {
        candidateId = candidate.id;
      }
    }
    
    const sorted = [...localCandidates].sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.email || '').localeCompare(b.email || '');
    });
    
    const targetCandidate = localCandidates.find((c: any) => c.id === candidateId);
    const targetEmail = targetCandidate?.email || email;

    const idx = sorted.findIndex((c: any) => {
      if (targetEmail && c.email) {
        return c.email.toLowerCase() === targetEmail.toLowerCase();
      }
      return c.id === candidateId;
    });

    if (idx !== -1) {
      return `APX-${1000 + idx}`;
    }
    return `APX-UNKNOWN`;
  };

  const handleStartEditScore = (score: any) => {
    setEditingScore(score);
    
    // Calculate current correct count
    const scoreData = score.score_data || {};
    const examData = scoreData.examData || [];
    const answers = scoreData.answers || {};

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
          const fibAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
          if (fibAns?.toString().trim().toLowerCase() === correctAnswer?.toString().trim().toLowerCase()) correctCount++;
        } else {
          // MCQ/TF: answers stored as array by exam page e.g. ["India"] — unwrap first element
          const singleAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
          if (singleAns === correctAnswer) correctCount++;
        }
      });
    });

    setEditSForm({
      correctAnswers: correctCount,
      totalQuestions: totalQuestions || 10,
      status: score.status || 'submitted'
    });
  };

  const handleSaveEditScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScore) return;

    try {
      // Re-generate a mock score_data or preserve and update it
      const originalScoreData = editingScore.score_data || {};
      const newScoreData = {
        ...originalScoreData,
        // Re-fill mockup questions structure to match correctAnswers
        examData: [
          {
            title: 'Section: Aptitude Core',
            questions: Array.from({ length: editSForm.totalQuestions }, (_, i) => ({
              id: `q-${i}`,
              answer: 'A',
              type: 'MCQ'
            }))
          }
        ],
        // Populate matching responses to get target correctAnswers count
        answers: Object.fromEntries(
          Array.from({ length: editSForm.totalQuestions }, (_, i) => [
            `q-${i}`,
            i < editSForm.correctAnswers ? 'A' : 'B'
          ])
        ),
        violations: originalScoreData.violations || 0
      };

      // 1. Update local storage
      const localScores = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
      const updated = localScores.map((s: any) => {
        if (s.id === editingScore.id) {
          return {
            ...s,
            status: editSForm.status,
            score_data: newScoreData
          };
        }
        return s;
      });
      localStorage.setItem('allSubmissions', JSON.stringify(updated));

      // 2. Update Supabase
      const { error } = await supabase
        .from('submissions')
        .update({
          status: editSForm.status,
          score_data: newScoreData
        })
        .eq('id', editingScore.id);

      if (error) {
        console.error("Supabase score edit error:", error);
      }

      setEditingScore(null);
      fetchScores();
      alert("Exam result updated successfully!");
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving results.");
    }
  };

  const handleDeleteScore = async (scoreId: string) => {
    if (!window.confirm("Are you sure you want to delete this candidate's exam result? This action cannot be undone.")) {
      return;
    }

    try {
      // 1. Delete from local storage
      const localScores = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
      const updated = localScores.filter((s: any) => s.id !== scoreId);
      localStorage.setItem('allSubmissions', JSON.stringify(updated));

      // 2. Delete from Supabase
      const { error } = await supabase
        .from('submissions')
        .delete()
        .eq('id', scoreId);

      if (error) {
        console.error("Supabase score deletion error:", error);
      }

      fetchScores();
      alert("Result deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete exam result.");
    }
  };

  const fetchScores = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          start_time,
          end_time,
          score_data,
          profiles ( full_name, email )
        `)
        .eq('status', 'submitted')
        .order('end_time', { ascending: false });

      const localScores = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
      const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      
      let mergedScores = [...localScores.reverse()];
      if (data && !error) {
        // Add supabase data not already in local. Deduplicate by email to avoid double-entries
        // (local uses text IDs like APX-1000; Supabase uses UUIDs — so id-based dedup fails)
        const localEmails = new Set(
          mergedScores
            .map(s => (Array.isArray(s.profiles) ? s.profiles[0] : s.profiles)?.email?.toLowerCase().trim())
            .filter(Boolean)
        );
        (data as any).forEach((s: any) => {
          const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
          const email = profile?.email?.toLowerCase().trim();
          if (!localEmails.has(email) && profile?.full_name !== 'Anonymous' && profile?.full_name) {
            mergedScores.push({ ...s, profiles: profile });
          }
        });
      }

      // Final dedup by email — keep one (most recent) per candidate
      const seenEmails = new Set<string>();
      mergedScores = mergedScores.filter((s: any) => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        const email = profile?.email?.toLowerCase().trim();
        if (!email) return true; // keep entries without email
        if (seenEmails.has(email)) return false;
        seenEmails.add(email);
        return true;
      });

      // Get all active candidate profiles to match emails and filter stale data
      const { data: supabaseProfiles } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'candidate');

      const enrichedSupabase = (supabaseProfiles || []).map((c: any) => ({
        ...c,
        status: c.status || (c.exam_slot ? 'Approved' : 'Pending')
      }));

      const uniqueLocal: any[] = [];
      const localSeen = new Set<string>();
      localCandidates.forEach((c: any) => {
        const emailKey = c.email?.toLowerCase().trim();
        if (emailKey) {
          if (!localSeen.has(emailKey)) {
            localSeen.add(emailKey);
            uniqueLocal.push(c);
          }
        } else {
          uniqueLocal.push(c);
        }
      });

      const supabaseIds = new Set(enrichedSupabase.map((c: any) => c.id));
      const supabaseEmails = new Set(enrichedSupabase.map((c: any) => c.email?.toLowerCase().trim()));
      const offlineOnly = uniqueLocal.filter((c: any) => {
        const isLocalCandidate = c.role === 'candidate';
        const inSupabase = supabaseIds.has(c.id) || (c.email && supabaseEmails.has(c.email.toLowerCase().trim()));
        return isLocalCandidate && !inSupabase;
      });

      const allMergedCandidates = [...enrichedSupabase, ...offlineOnly];
      const activeCandidateEmails = new Set(allMergedCandidates.map(c => c.email?.toLowerCase().trim()).filter(Boolean));
      const activeCandidateNames = new Set(allMergedCandidates.map(c => (c.full_name || c.fullName)?.toLowerCase().trim()).filter(Boolean));

      const getEmailFromSubmission = (s: any) => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return (profile?.email || s.email || s.candidateEmail || '')?.toLowerCase().trim();
      };

      const getNameFromSubmission = (s: any) => {
        const profile = Array.isArray(s.profiles) ? s.profiles[0] : s.profiles;
        return (profile?.full_name || profile?.fullName || s.name || s.candidateName || '')?.toLowerCase().trim();
      };

      // Filter mergedScores to include active candidates by Email OR Name
      let finalScores = mergedScores.filter((s: any) => {
        const email = getEmailFromSubmission(s);
        const name = getNameFromSubmission(s);
        return (email && activeCandidateEmails.has(email)) || (name && activeCandidateNames.has(name));
      });

      // Add registered candidates who haven't submitted yet as 'pending'
      const submittedEmails = new Set(finalScores.map(s => getEmailFromSubmission(s)).filter(Boolean));
      const submittedNames = new Set(finalScores.map(s => getNameFromSubmission(s)).filter(Boolean));
      
      allMergedCandidates.forEach((cand: any) => {
        const emailKey = cand.email?.toLowerCase().trim();
        const nameKey = (cand.full_name || cand.fullName)?.toLowerCase().trim();
        
        const hasSubmittedEmail = emailKey && submittedEmails.has(emailKey);
        const hasSubmittedName = nameKey && submittedNames.has(nameKey);

        if (!hasSubmittedEmail && !hasSubmittedName) {
          finalScores.push({
            id: `PENDING-${cand.id || Date.now() + Math.random()}`,
            status: 'pending',
            start_time: null,
            end_time: null,
            score_data: null,
            profiles: {
              full_name: cand.full_name || cand.fullName,
              email: cand.email
            }
          });
        }
      });

      setScores(finalScores);
    } catch (err) {
      console.error(err);
      const localScores = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
      setScores(localScores.reverse());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();

    const channel = supabase
      .channel('score-sync-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, fetchScores)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleExport = () => {
    const csvRows = [
      ['Submission ID', 'Candidate Name', 'Email', 'Correct Answers', 'Total Questions', 'Percentage', 'Status', 'Time Taken']
    ];

    filteredScores.forEach(score => {
      const scoreData = score.score_data || {};
      const examData = scoreData.examData || [];
      const answers = scoreData.answers || {};

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
            const fibAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
            if (fibAns?.toString().trim().toLowerCase() === correctAnswer?.toString().trim().toLowerCase()) correctCount++;
          } else {
            const singleAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
            if (singleAns === correctAnswer) correctCount++;
          }
        });
      });

      if (totalQuestions === 0) {
        // Skip rows with no actual questions/answers instead of mocking them
        return;
      }

      const percentage = Math.round((correctCount / totalQuestions) * 100);
      const passed = percentage >= 40;

      let timeTaken = 'N/A';
      if (score.start_time && score.end_time) {
        const diffMs = new Date(score.end_time).getTime() - new Date(score.start_time).getTime();
        timeTaken = `${Math.round(diffMs / 60000)} mins`;
      }

      csvRows.push([
        getCandidateApxId(score),
        score.profiles?.full_name || 'Anonymous',
        score.profiles?.email || '',
        correctCount.toString(),
        totalQuestions.toString(),
        `${percentage}%`,
        passed ? 'PASSED' : 'FAILED',
        timeTaken
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Aptitude_Edge_Results.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredScores = scores.filter(score => 
    score.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    score.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.tableContainer}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search candidate results by name..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.actionGroup}>
          <button className={styles.btnPrimary} onClick={handleExport}>
            <Download size={16} /> Export Results (CSV)
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Submission ID</th>
              <th>Candidate Name</th>
              <th>Exam Name</th>
              <th>Score / Correct</th>
              <th>Percentage</th>
              <th>Status</th>
              <th>Time Taken</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>Syncing completed results...</td></tr>
            ) : filteredScores.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '20px' }}>No completed exams found in the database.</td></tr>
            ) : filteredScores.map((score, index) => {
              if (score.status === 'pending') {
                return (
                  <tr key={`${score.id}-${index}`}>
                    <td><strong>{getCandidateApxId(score)}</strong></td>
                    <td>
                      <div className={styles.userCell}>
                        <strong>{score.profiles?.full_name}</strong>
                        <span>{score.profiles?.email}</span>
                      </div>
                    </td>
                    <td>Aptitude Edge Core Assessment</td>
                    <td><strong>- / -</strong></td>
                    <td><strong>-</strong></td>
                    <td>
                      <span className={styles.badge} style={{ backgroundColor: '#f59e0b', color: '#fff' }}>
                        PENDING
                      </span>
                    </td>
                    <td>-</td>
                    <td>
                      <div className={styles.actionGroup} style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className={styles.btnOutline}
                          style={{ padding: '0.4rem', borderColor: '#ef4444', color: '#ef4444' }}
                          title="Delete"
                          onClick={() => handleDeleteScore(score.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              const scoreData = score.score_data || {};
              const examData = scoreData.examData || [];
              const answers = scoreData.answers || {};

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
                    const fibAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
                    if (fibAns?.toString().trim().toLowerCase() === correctAnswer?.toString().trim().toLowerCase()) correctCount++;
                  } else {
                    const singleAns = Array.isArray(userAnswer) ? userAnswer[0] : userAnswer;
                    if (singleAns === correctAnswer) correctCount++;
                  }
                });
              });

              if (totalQuestions === 0) {
                return null; // Don't show empty/mock rows
              }

              const percentage = Math.round((correctCount / totalQuestions) * 100);
              const cutoff = 40;
              const passed = percentage >= cutoff;
              
              let timeTaken = 'N/A';
              if (score.start_time && score.end_time) {
                const diffMs = new Date(score.end_time).getTime() - new Date(score.start_time).getTime();
                timeTaken = `${Math.round(diffMs / 60000)} mins`;
              }

              return (
                <tr key={`${score.id}-${index}`}>
                  <td><strong>{getCandidateApxId(score)}</strong></td>
                  <td>
                    <div className={styles.userCell}>
                      <strong>{score.profiles?.full_name || 'Anonymous'}</strong>
                      <span>{score.profiles?.email}</span>
                    </div>
                  </td>
                  <td>Aptitude Edge Core Assessment</td>
                  <td>
                    <strong>{correctCount} / {totalQuestions}</strong>
                  </td>
                  <td>
                    <strong>{percentage}%</strong>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${passed ? styles.badgeSuccess : styles.badgeDanger}`}>
                      {passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </td>
                  <td>{timeTaken}</td>
                  <td>
                    <div className={styles.actionGroup} style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className={styles.btnOutline}
                        style={{ padding: '0.4rem', borderColor: '#0ea5e9', color: '#0ea5e9' }}
                        title="Edit Score"
                        onClick={() => handleStartEditScore(score)}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        className={styles.btnOutline}
                        style={{ padding: '0.4rem', borderColor: '#ef4444', color: '#ef4444' }}
                        title="Delete Result"
                        onClick={() => handleDeleteScore(score.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit Score Modal */}
      {editingScore && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', width: '480px', padding: '28px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={20} color="#008F8C" />
                <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#1e293b' }}>Edit Exam Result</h2>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setEditingScore(null)}>
                <X size={20} />
              </button>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              Editing result for: <strong style={{ color: '#1e293b' }}>{editingScore.profiles?.full_name || 'Candidate'}</strong>
              <span style={{ marginLeft: '8px', color: '#94a3b8' }}>({editingScore.profiles?.email})</span>
            </div>
            <form onSubmit={handleSaveEditScore} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Correct Answers</label>
                  <input
                    type="number"
                    min={0}
                    max={editSForm.totalQuestions}
                    className={styles.searchInput}
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={editSForm.correctAnswers}
                    onChange={(e) => setEditSForm({ ...editSForm, correctAnswers: parseInt(e.target.value) || 0 })}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Total Questions</label>
                  <input
                    type="number"
                    min={1}
                    className={styles.searchInput}
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={editSForm.totalQuestions}
                    onChange={(e) => setEditSForm({ ...editSForm, totalQuestions: parseInt(e.target.value) || 10 })}
                    required
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Submission Status</label>
                <select
                  className={styles.searchInput}
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={editSForm.status}
                  onChange={(e) => setEditSForm({ ...editSForm, status: e.target.value })}
                >
                  <option value="submitted">Submitted</option>
                  <option value="pending">Pending</option>
                  <option value="flagged">Flagged</option>
                </select>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 14px', fontSize: '0.82rem', color: '#15803d' }}>
                Score preview: <strong>{editSForm.correctAnswers} / {editSForm.totalQuestions}</strong> — {Math.round((editSForm.correctAnswers / (editSForm.totalQuestions || 1)) * 100)}% — {Math.round((editSForm.correctAnswers / (editSForm.totalQuestions || 1)) * 100) >= 40 ? '✅ PASSED' : '❌ FAILED'}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" className={styles.btnOutline} onClick={() => setEditingScore(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#008F8C', color: 'white', border: 'none' }}>Save Result</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
