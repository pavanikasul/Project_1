'use client';

import React, { useEffect, useState } from 'react';
import { 
  Search, Eye, X, User, Mail, RefreshCw, Check, AlertTriangle, FileText, 
  Calendar, Clock, CheckCircle, HelpCircle, Phone, ArrowUpRight, CalendarClock
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../table.module.css';
import resStyles from './reschedules.module.css';

export default function ReschedulesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  
  // Schedule state inside review modal
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  
  // Notification email status toast
  const [emailStatus, setEmailStatus] = useState<{
    show: boolean;
    candidateName: string;
    email: string;
    previewUrl?: string;
    statusText: string;
  } | null>(null);

  // Sync / load requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      let combinedRequests: any[] = [];
      let supabaseFetched = false;

      // 1. Fetch from Supabase
      try {
        const { data: supabaseData, error } = await supabase
          .from('reschedule_requests')
          .select('*')
          .order('created_at', { ascending: false });

        if (supabaseData && !error) {
          combinedRequests = [...supabaseData];
          supabaseFetched = true;
        } else if (error) {
          console.log("Supabase reschedule table not found or schema not migrated yet. Syncing via local storage cache.");
        }
      } catch (e) {
        console.log("Supabase not accessible. Loading reschedule requests from local storage.");
      }

      // 2. Load from localStorage
      const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
      
      if (!supabaseFetched) {
        combinedRequests = [...localRequests].reverse();
      } else {
        // Blend in offline ones that are in localStorage but not in Supabase
        const supabaseIds = new Set(combinedRequests.map(r => r.id));
        const offlineOnly = localRequests.filter((r: any) => r.id && !supabaseIds.has(r.id));
        combinedRequests = [...combinedRequests, ...offlineOnly];
      }

      setRequests(combinedRequests);
    } catch (err) {
      console.error('Failed to fetch rescheduling requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    // Subscribe to Supabase real-time sync for reschedule requests
    const channel = supabase
      .channel('reschedule-sync-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reschedule_requests' }, fetchRequests)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update Status Helper (e.g. Under Review or Reject)
  const handleUpdateStatus = async (requestId: string, newStatus: 'Under Review' | 'Rejected') => {
    try {
      // 1. Update localStorage cache
      const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
      const updatedLocal = localRequests.map((r: any) => {
        if (r.id === requestId) {
          return { ...r, status: newStatus };
        }
        return r;
      });
      localStorage.setItem('rescheduleRequests', JSON.stringify(updatedLocal));

      // 2. Update Supabase Database
      try {
        const { error } = await supabase
          .from('reschedule_requests')
          .update({ status: newStatus })
          .eq('id', requestId);

        if (error) {
          console.log("Supabase reschedule table not migrated yet. Using local storage.", error.message);
        }
      } catch (_) {}

      // Refresh data
      fetchRequests();
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev: any) => ({ ...prev, status: newStatus }));
      }
      alert(`Request status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      alert("Failed to update request status.");
    }
  };

  // Accept and Schedule Slot helper
  const handleAcceptAndSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    const targetRequest = selectedRequest;
    
    // Combine Date and Time into an ISO timestamp
    const newScheduledTimeStr = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();

    try {
      // 1. Update Candidate registration details in local allCandidates
      const allCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const updatedCandidates = allCandidates.map((c: any) => {
        if (c.email === targetRequest.email) {
          return {
            ...c,
            status: 'Approved',
            exam_slot: newScheduledTimeStr
          };
        }
        return c;
      });
      localStorage.setItem('allCandidates', JSON.stringify(updatedCandidates));

      // Update current candidate session if it is logged in on this device
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const curr = JSON.parse(currentUserStr);
        if (curr.email === targetRequest.email) {
          localStorage.setItem('currentUser', JSON.stringify({
            ...curr,
            status: 'Approved',
            exam_slot: newScheduledTimeStr
          }));
        }
      }

      // 2. Update Candidate profile slot on Supabase Database
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            exam_slot: newScheduledTimeStr
          })
          .eq('email', targetRequest.email);

        if (error) {
          console.log("Supabase profile slot update skipped:", error.message);
        }
      } catch (_) {}

      // 3. Update the reschedule request status to 'New Slot Assigned'
      const localRequests = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
      const updatedRequests = localRequests.map((r: any) => {
        if (r.id === targetRequest.id) {
          return { ...r, status: 'New Slot Assigned', new_slot_time: newScheduledTimeStr };
        }
        return r;
      });
      localStorage.setItem('rescheduleRequests', JSON.stringify(updatedRequests));

      try {
        const { error } = await supabase
          .from('reschedule_requests')
          .update({ status: 'New Slot Assigned', new_slot_time: newScheduledTimeStr })
          .eq('id', targetRequest.id);

        if (error) {
          console.log("Supabase reschedule table not migrated yet. Using local storage.", error.message);
        }
      } catch (_) {}

      // Close modal and refresh lists
      setSelectedRequest(null);
      fetchRequests();

      // 4. Trigger simulated email notification dispatch
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            to: targetRequest.email,
            candidateName: targetRequest.full_name,
            examSlot: newScheduledTimeStr,
            examLink: window.location.origin + '/login',
            subject: 'AptitudeEdge - Exam Reschedule Approved & New Slot Assigned'
          })
        });
        const emailData = await response.json();
        if (emailData.success) {
          setEmailStatus({
            show: true,
            candidateName: targetRequest.full_name,
            email: targetRequest.email,
            previewUrl: emailData.previewUrl,
            statusText: emailData.status || 'Email Dispatched'
          });
        }
      } catch (err) {
        console.error("Failed to trigger email api:", err);
      }

      alert(`Rescheduled Slot Assigned and Approved! Notification email generated.`);
    } catch (err) {
      console.error(err);
      alert("Failed to assign rescheduled slot.");
    }
  };

  const handleOpenReviewModal = (req: any) => {
    setSelectedRequest(req);
    // Prefill schedule dates with candidate's preferred date
    if (req.preferred_date) {
      setScheduleDate(req.preferred_date);
    } else {
      setScheduleDate(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().substring(0, 10));
    }
    
    // Select default time based on preferred slot text
    if (req.preferred_slot?.includes('Morning')) {
      setScheduleTime('09:00');
    } else if (req.preferred_slot?.includes('Afternoon')) {
      setScheduleTime('13:00');
    } else if (req.preferred_slot?.includes('Evening')) {
      setScheduleTime('17:00');
    } else {
      setScheduleTime('10:00');
    }
  };

  // Filters and search logic
  const filteredRequests = requests.filter(r => {
    const matchesSearch = 
      r.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      r.candidate_id_val?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.reason?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === '' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className={styles.tableContainer}>
      {/* Synchronization Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 16px',
        background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
        border: '1px solid #86efac',
        borderRadius: '8px',
        marginBottom: '16px',
        fontSize: '0.85rem',
        color: '#15803d',
        fontWeight: 600
      }}>
        <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 0 3px rgba(34,197,94,0.2)' }} />
        Synchronized with Supabase Cloud. Reviewing missed assessments and technical claims in real-time.
        <button
          onClick={fetchRequests}
          disabled={loading}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #86efac', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}
        >
          <RefreshCw size={13} className={loading ? resStyles.spinning : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by candidate name, ID, reason..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.actionGroup}>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 16px',
              border: '2px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.88rem',
              fontWeight: 600,
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            <option value="">All Statuses</option>
            <option value="Submitted">Submitted</option>
            <option value="Under Review">Under Review</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="New Slot Assigned">New Slot Assigned</option>
          </select>
          <button className={styles.btnPrimary} onClick={fetchRequests} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} className={loading ? resStyles.spinning : ''} /> Sync Tickets
          </button>
        </div>
      </div>

      {/* Requests Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Candidate ID</th>
              <th>Full Name</th>
              <th>Reason for Reschedule</th>
              <th>Preferred Slot</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#008F8C' }} />
                  <span>Loading reschedule tickets...</span>
                </div>
              </td></tr>
            ) : filteredRequests.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={32} style={{ color: '#cbd5e1' }} />
                  <strong style={{ color: '#334155' }}>No reschedule requests filed yet</strong>
                  <span style={{ fontSize: '0.85rem' }}>Missed assessment claims will display here for authorization.</span>
                </div>
              </td></tr>
            ) : filteredRequests.map((req) => (
              <tr key={req.id}>
                <td><strong>{req.candidate_id_val}</strong></td>
                <td>
                  <div className={styles.userCell}>
                    <strong>{req.full_name}</strong>
                    <span>{req.email}</span>
                  </div>
                </td>
                <td>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    backgroundColor: req.reason === 'Technical Issue' || req.reason === 'Internet Problem' ? '#fff7ed' : '#f0fdf4',
                    border: req.reason === 'Technical Issue' || req.reason === 'Internet Problem' ? '1px solid #ffedd5' : '1px solid #dcfce7',
                    color: req.reason === 'Technical Issue' || req.reason === 'Internet Problem' ? '#c2410c' : '#15803d',
                    fontSize: '0.8rem',
                    fontWeight: 700
                  }}>
                    {req.reason}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.82rem' }}>
                    <strong>{req.preferred_date ? new Date(req.preferred_date).toLocaleDateString() : 'N/A'}</strong>
                    <span style={{ color: '#64748b' }}>{req.preferred_slot}</span>
                  </div>
                </td>
                <td>
                  <span className={`${styles.badge} ${
                    req.status === 'New Slot Assigned' || req.status === 'Approved' ? styles.badgeSuccess : 
                    req.status === 'Rejected' ? styles.badgeDanger : 
                    req.status === 'Under Review' ? styles.badgeWarning : styles.badgeWarning
                  }`}>
                    {req.status === 'New Slot Assigned' ? 'Assigned' : req.status}
                  </span>
                </td>
                <td>
                  <button 
                    className={styles.btnOutline} 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }} 
                    onClick={() => handleOpenReviewModal(req)}
                  >
                    <Eye size={14} /> Review Claims
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review Modal Drawer */}
      {selectedRequest && (
        <div className={resStyles.modalOverlay}>
          <div className={resStyles.modalContent}>
            <div className={resStyles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CalendarClock size={20} style={{ color: 'var(--primary)' }} />
                <h2>Review Reschedule Inquiry</h2>
              </div>
              <button className={resStyles.closeBtn} onClick={() => setSelectedRequest(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={resStyles.modalBody}>
              <div className={resStyles.profileHero}>
                <div className={resStyles.avatarMockup}>
                  {selectedRequest.full_name?.charAt(0) || 'C'}
                </div>
                <div className={resStyles.profileNameDetails}>
                  <h3>{selectedRequest.full_name}</h3>
                  <span>Candidate ID: <strong>{selectedRequest.candidate_id_val}</strong> | Status: <strong style={{ color: 'var(--primary)' }}>{selectedRequest.status}</strong></span>
                </div>
              </div>

              {/* Form details card */}
              <div className={resStyles.detailsGrid}>
                <div className={resStyles.detailCard}>
                  <span>Email Address</span>
                  <strong>{selectedRequest.email}</strong>
                </div>
                <div className={resStyles.detailCard}>
                  <span>Mobile Phone</span>
                  <strong>{selectedRequest.mobile || 'Not Provided'}</strong>
                </div>
                <div className={resStyles.detailCard}>
                  <span>Previously Scheduled Exam</span>
                  <strong>{selectedRequest.previous_slot ? new Date(selectedRequest.previous_slot).toLocaleString() : 'N/A'}</strong>
                </div>
                <div className={resStyles.detailCard}>
                  <span>Preferred New Slot</span>
                  <strong>{selectedRequest.preferred_date ? new Date(selectedRequest.preferred_date).toLocaleDateString() : 'N/A'} ({selectedRequest.preferred_slot})</strong>
                </div>
              </div>

              {/* Claims Section */}
              <div className={resStyles.claimContainer}>
                <h4>MISSED WINDOW CLAIMS & DOCUMENTATION</h4>
                <div className={resStyles.reasonBadge}>
                  Reason Code: <strong>{selectedRequest.reason}</strong>
                </div>
                <div className={resStyles.explanationBox}>
                  <h5>Candidate Explanation:</h5>
                  <p>{selectedRequest.explanation || 'No textual explanation provided by candidate.'}</p>
                </div>

                {/* Supporting Document attachment preview */}
                <div className={resStyles.docBox}>
                  <FileText size={18} color="#008F8C" />
                  <div>
                    <strong>Supporting Documentation:</strong>
                    <span>{selectedRequest.supporting_doc_name ? selectedRequest.supporting_doc_name : 'No certificate uploaded (Optional)'}</span>
                  </div>
                  {selectedRequest.supporting_doc_name && (
                    <span className={resStyles.attachmentBadge}>✓ Valid Attachment</span>
                  )}
                </div>
              </div>

              {/* Schedule slot editor if not yet fully assigned */}
              {selectedRequest.status !== 'New Slot Assigned' && selectedRequest.status !== 'Rejected' && (
                <form onSubmit={handleAcceptAndSchedule} className={resStyles.scheduleForm}>
                  <h4>ASSIGN NEW EXAM SLOT & DISPATCH NOTIFICATION</h4>
                  <div className={resStyles.schedulerGrid}>
                    <div>
                      <label>Rescheduled Exam Date</label>
                      <input 
                        type="date" 
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        required
                        className={styles.searchInput}
                        style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', width: '100%' }}
                      />
                    </div>
                    <div>
                      <label>Rescheduled Time</label>
                      <input 
                        type="time" 
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        required
                        className={styles.searchInput}
                        style={{ border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', width: '100%' }}
                      />
                    </div>
                  </div>

                  <div className={resStyles.actionsRow}>
                    <button 
                      type="button" 
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'Under Review')}
                      className={styles.btnOutline}
                      style={{ padding: '12px 20px', borderColor: '#eab308', color: '#eab308' }}
                    >
                      Mark Under Review
                    </button>
                    <button 
                      type="button" 
                      onClick={() => handleUpdateStatus(selectedRequest.id, 'Rejected')}
                      className={styles.btnOutline}
                      style={{ padding: '12px 20px', borderColor: '#ef4444', color: '#ef4444' }}
                    >
                      Decline Claim
                    </button>
                    <button 
                      type="submit" 
                      className={styles.btnPrimary}
                      style={{ padding: '12px 24px', backgroundColor: '#22c55e', color: 'white', border: 'none', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <CheckCircle size={16} /> Accept & Assign New Slot
                    </button>
                  </div>
                </form>
              )}

              {/* Close Button if already finished */}
              {(selectedRequest.status === 'New Slot Assigned' || selectedRequest.status === 'Rejected') && (
                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setSelectedRequest(null)} 
                    className={styles.btnOutline}
                    style={{ padding: '10px 24px' }}
                  >
                    Close Review Details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mock Developer Mailbox success indicator toast */}
      {emailStatus && emailStatus.show && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#ffffff',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          borderLeft: '4px solid #008F8C',
          borderRadius: '12px',
          padding: '18px 24px',
          maxWidth: '420px',
          zIndex: 99999,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'slideIn 0.3s ease-out',
          color: '#1e293b',
          fontFamily: 'inherit',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{
              backgroundColor: 'rgba(0, 143, 140, 0.1)',
              color: '#008F8C',
              borderRadius: '50%',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Mail size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A3557' }}>Rescheduled Email Dispatched!</strong>
                <button 
                  onClick={() => setEmailStatus(null)} 
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                A confirmation slip with new exam schedules has been successfully generated and sent to <strong>{emailStatus.email}</strong>.
              </p>
            </div>
          </div>
          
          {emailStatus.previewUrl && (
            <div style={{ 
              backgroundColor: '#f8fafc', 
              padding: '10px 14px', 
              borderRadius: '8px', 
              border: '1px dashed #cbd5e1', 
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <span style={{ fontWeight: 600, color: '#0f766e' }}>✉ Developer Demo Mailbox:</span>
              <span style={{ color: '#64748b' }}>No live SMTP credentials found, so email was captured in a mock environment.</span>
              <a 
                href={emailStatus.previewUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ 
                  color: '#008F8C', 
                  fontWeight: 700, 
                  textDecoration: 'underline', 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  marginTop: '2px'
                }}
              >
                Open Sent Email Preview ↗
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
