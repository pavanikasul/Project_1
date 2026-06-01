'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, Activity, PlayCircle, Video, Mic, Wifi, AlertTriangle, Clock, RefreshCw, X, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../table.module.css';
import liveStyles from './live.module.css';

export default function LiveExamsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExam, setSelectedExam] = useState<any | null>(null);

  const fetchLiveExams = async () => {
    try {
      const { data, error } = await supabase
        .from('submissions')
        .select(`
          id,
          status,
          start_time,
          warning_count,
          exam_data,
          profiles ( full_name, email, mobile, id_proof_type, id_proof_number ),
          violations ( id, type, timestamp, details )
        `)
        .eq('status', 'ongoing')
        .order('start_time', { ascending: false });

      const localLive = JSON.parse(localStorage.getItem('liveExams') || '{}');
      const localLiveArray = Object.values(localLive) as any[];
      
      let mergedExams = [...localLiveArray];
      if (data && !error) {
        const localIds = new Set(mergedExams.map(e => e.id));
        data.forEach(e => {
          if (!localIds.has(e.id)) {
            mergedExams.push(e);
          }
        });
      }
      
      setExams(mergedExams);
      if (selectedExam) {
        const updated = mergedExams.find(e => e.id === selectedExam.id);
        if (updated) setSelectedExam(updated);
      }
    } catch (err) {
      console.error(err);
      const localLive = JSON.parse(localStorage.getItem('liveExams') || '{}');
      const localLiveArray = Object.values(localLive) as any[];
      setExams(localLiveArray);
      if (selectedExam) {
        const updated = localLiveArray.find(e => e.id === selectedExam.id);
        if (updated) setSelectedExam(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveExams();

    const channel = supabase
      .channel('live-monitor-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, fetchLiveExams)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, fetchLiveExams)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedExam]);

  const formatTime = (seconds: number) => {
    if (!seconds || seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const filteredExams = exams.filter(exam => 
    exam.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    exam.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.tableContainer}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search live candidates..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.actionGroup}>
          <button className={styles.btnOutline} onClick={fetchLiveExams}>
            <RefreshCw size={16} className={loading ? liveStyles.spin : ''} style={{ marginRight: '6px' }} /> Refresh
          </button>
          <span className={liveStyles.liveIndicator}>
            <span className={liveStyles.livePulse} /> Real-time active ({exams.length})
          </span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Candidate Name</th>
              <th>Current Section</th>
              <th>Time Remaining</th>
              <th>Device Status</th>
              <th>Security Level</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && exams.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>Syncing live exams from backend...</td></tr>
            ) : filteredExams.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '30px' }}>No candidates are currently taking exams.</td></tr>
            ) : filteredExams.map((exam) => {
              const status = exam.exam_data?.proctoring_status || {};
              const webcam = status.webcam || 'active';
              const microphone = status.microphone || 'active';
              const internet = status.internet || 'online';
              const remainingTime = status.remaining_time !== undefined ? status.remaining_time : 3540;

              return (
                <tr key={exam.id}>
                  <td>
                    <div className={styles.userCell}>
                      <strong>{exam.profiles?.full_name || 'Anonymous Candidate'}</strong>
                      <span>{exam.profiles?.email}</span>
                    </div>
                  </td>
                  <td>
                    <span className={liveStyles.sectionBadge}>
                      {exam.exam_data?.section || 'Aptitude Test'}
                    </span>
                  </td>
                  <td>
                    <div className={liveStyles.timeCell}>
                      <Clock size={14} style={{ marginRight: '6px', color: '#64748b' }} />
                      <strong>{formatTime(remainingTime)}</strong>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span 
                        className={`${liveStyles.deviceBadge} ${webcam === 'active' ? liveStyles.deviceOn : liveStyles.deviceOff}`} 
                        title={`Webcam: ${webcam}`}
                      >
                        <Video size={12} />
                      </span>
                      <span 
                        className={`${liveStyles.deviceBadge} ${microphone === 'active' ? liveStyles.deviceOn : liveStyles.deviceOff}`} 
                        title={`Microphone: ${microphone}`}
                      >
                        <Mic size={12} />
                      </span>
                      <span 
                        className={`${liveStyles.deviceBadge} ${internet === 'online' ? liveStyles.deviceOn : liveStyles.deviceOff}`} 
                        title={`Internet: ${internet}`}
                      >
                        <Wifi size={12} />
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${exam.warning_count >= 2 ? styles.badgeDanger : exam.warning_count > 0 ? styles.badgeWarning : styles.badgeSuccess}`}>
                      {exam.warning_count || 0}/3 Warnings
                    </span>
                  </td>
                  <td>
                    <button 
                      className={styles.btnPrimary} 
                      style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }} 
                      onClick={() => setSelectedExam(exam)}
                    >
                      <Eye size={14} /> Monitor Live
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Monitor Detail Modal */}
      {selectedExam && (
        <div className={liveStyles.modalOverlay}>
          <div className={liveStyles.modalContent}>
            <div className={liveStyles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Activity className={liveStyles.pulseIcon} size={20} />
                <h2>Live Session Monitor: {selectedExam.profiles?.full_name}</h2>
              </div>
              <button className={liveStyles.closeBtn} onClick={() => setSelectedExam(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={liveStyles.modalGrid}>
              {/* Left Column - Video Mockup & Specs */}
              <div className={liveStyles.modalLeft}>
                <div className={liveStyles.videoStreamMockup}>
                  <div className={liveStyles.videoPlaceholder}>
                    <Video size={48} className={liveStyles.videoIcon} />
                    <p style={{ fontWeight: 700 }}>LIVE PROCTORING STREAM ACTIVE</p>
                    <span className={liveStyles.liveOverlayBadge}>Webcam Active</span>
                  </div>
                </div>

                <div className={liveStyles.specsGrid}>
                  <div className={liveStyles.specCard}>
                    <span>Webcam Access</span>
                    <strong style={{ color: selectedExam.exam_data?.proctoring_status?.webcam === 'inactive' ? '#e11d48' : '#16a34a' }}>
                      {selectedExam.exam_data?.proctoring_status?.webcam === 'inactive' ? 'INACTIVE / BLOCKED' : 'ACTIVE'}
                    </strong>
                  </div>
                  <div className={liveStyles.specCard}>
                    <span>Microphone</span>
                    <strong style={{ color: selectedExam.exam_data?.proctoring_status?.microphone === 'inactive' ? '#e11d48' : '#16a34a' }}>
                      {selectedExam.exam_data?.proctoring_status?.microphone === 'inactive' ? 'MUTED' : 'MONITORING'}
                    </strong>
                  </div>
                  <div className={liveStyles.specCard}>
                    <span>Network status</span>
                    <strong style={{ color: selectedExam.exam_data?.proctoring_status?.internet === 'offline' ? '#e11d48' : '#16a34a' }}>
                      {selectedExam.exam_data?.proctoring_status?.internet === 'offline' ? 'DISCONNECTED' : 'EXCELLENT (ONLINE)'}
                    </strong>
                  </div>
                  <div className={liveStyles.specCard}>
                    <span>Time Left</span>
                    <strong>{formatTime(selectedExam.exam_data?.proctoring_status?.remaining_time !== undefined ? selectedExam.exam_data.proctoring_status.remaining_time : 3540)}</strong>
                  </div>
                </div>
              </div>

              {/* Right Column - Logs & Candidate Info */}
              <div className={liveStyles.modalRight}>
                <div className={liveStyles.detailsGroup}>
                  <h3>Candidate Information</h3>
                  <div className={liveStyles.infoRow}>
                    <span>Email:</span>
                    <strong>{selectedExam.profiles?.email}</strong>
                  </div>
                  <div className={liveStyles.infoRow}>
                    <span>Mobile:</span>
                    <strong>{selectedExam.profiles?.mobile || 'N/A'}</strong>
                  </div>
                  <div className={liveStyles.infoRow}>
                    <span>ID Proof:</span>
                    <strong>{selectedExam.profiles?.id_proof_type || 'Aadhar Card'} ({selectedExam.profiles?.id_proof_number || 'N/A'})</strong>
                  </div>
                </div>

                <div className={liveStyles.logsGroup}>
                  <h3>Tab Switches & Security Violation Logs</h3>
                  <div className={liveStyles.logList}>
                    {(!selectedExam.violations || selectedExam.violations.length === 0) ? (
                      <p className={liveStyles.noViolationsText}>No proctoring violations recorded for this candidate.</p>
                    ) : (
                      selectedExam.violations.map((viol: any) => (
                        <div key={viol.id} className={liveStyles.violationLogEntry}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong style={{ color: '#e11d48', fontSize: '0.85rem' }}>{viol.type}</strong>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {new Date(viol.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p style={{ fontSize: '0.8rem', margin: 0, color: '#475569' }}>{viol.details}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
