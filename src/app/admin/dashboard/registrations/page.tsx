'use client';

import React, { useEffect, useState } from 'react';
import { Search, Download, Eye, X, User, Mail, RefreshCw, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../table.module.css';
import regStyles from './registrations.module.css';

export default function RegistrationsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<any | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    show: boolean;
    candidateName: string;
    email: string;
    previewUrl?: string;
    statusText: string;
  } | null>(null);

  const [editingCandidate, setEditingCandidate] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    idType: 'Aadhar Card',
    idNumber: '',
    city: '',
    state: '',
    examSlot: ''
  });

  const getApxId = (candidateId: string) => {
    // Create a strictly stable sorted list to generate sequential APX-1000+ IDs
    const sorted = [...candidates].sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      // Guarantee distinct stable positions
      return (a.email || '').localeCompare(b.email || '');
    });

    // Find the target candidate in the current unsorted state to get their email
    const targetCandidate = candidates.find(c => c.id === candidateId);
    
    // Find index strictly using unique email if available, otherwise fallback to ID
    const idx = sorted.findIndex(c => {
      if (targetCandidate?.email && c.email) {
        return c.email.toLowerCase() === targetCandidate.email.toLowerCase();
      }
      return c.id === candidateId;
    });

    if (idx !== -1) {
      return `APX-${1000 + idx}`;
    }
    return `APX-UNKNOWN`;
  };

  const handleStartEditCandidate = (cand: any) => {
    setEditingCandidate(cand);
    setEditFormData({
      fullName: cand.full_name || cand.fullName || '',
      email: cand.email || '',
      mobile: cand.mobile || '',
      idType: cand.id_proof_type || cand.idType || 'Aadhar Card',
      idNumber: cand.id_proof_number || cand.idNumber || '',
      city: cand.city || '',
      state: cand.state || '',
      examSlot: cand.exam_slot ? new Date(cand.exam_slot).toISOString().substring(0, 16) : ''
    });
  };

  const handleSaveEditCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCandidate) return;

    try {
      // 1. Update local storage
      const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const updated = existingCandidates.map((c: any) => {
        if (c.id === editingCandidate.id) {
          return {
            ...c,
            fullName: editFormData.fullName,
            full_name: editFormData.fullName,
            email: editFormData.email,
            mobile: editFormData.mobile,
            idType: editFormData.idType,
            id_proof_type: editFormData.idType,
            idNumber: editFormData.idNumber,
            id_proof_number: editFormData.idNumber,
            city: editFormData.city,
            state: editFormData.state,
            exam_slot: editFormData.examSlot ? new Date(editFormData.examSlot).toISOString() : null
          };
        }
        return c;
      });
      localStorage.setItem('allCandidates', JSON.stringify(updated));

      // Update currentUser session if they are currently logged in on this device
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const curr = JSON.parse(currentUserStr);
        if (curr.id === editingCandidate.id) {
          localStorage.setItem('currentUser', JSON.stringify({
            ...curr,
            fullName: editFormData.fullName,
            full_name: editFormData.fullName,
            email: editFormData.email,
            mobile: editFormData.mobile,
            idType: editFormData.idType,
            id_proof_type: editFormData.idType,
            idNumber: editFormData.idNumber,
            id_proof_number: editFormData.idNumber,
            city: editFormData.city,
            state: editFormData.state,
            exam_slot: editFormData.examSlot ? new Date(editFormData.examSlot).toISOString() : null
          }));
        }
      }

      // 2. Update Supabase
      const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(editingCandidate.id);
      if (isUUID) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: editFormData.fullName,
            mobile: editFormData.mobile,
            email: editFormData.email,
            id_proof_type: editFormData.idType,
            id_proof_number: editFormData.idNumber,
            city: editFormData.city,
            state: editFormData.state,
            exam_slot: editFormData.examSlot ? new Date(editFormData.examSlot).toISOString() : null
          })
          .eq('id', editingCandidate.id);

        if (error) {
          console.error("Supabase profile edit error:", error);
        }
      } else {
        console.warn(`Skipped Supabase edit: ${editingCandidate.id} is an offline local ID.`);
      }
      
      setEditingCandidate(null);
      fetchCandidates();
      alert("Candidate updated successfully!");
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving candidate details.");
    }
  };

  const handleDeleteCandidate = async (candidateId: string) => {
    if (!window.confirm(`Are you sure you want to delete candidate ${getApxId(candidateId)}? This action cannot be undone.`)) {
      return;
    }

    try {
      // 1. Delete from local storage
      const existingCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const updated = existingCandidates.filter((c: any) => c.id !== candidateId);
      localStorage.setItem('allCandidates', JSON.stringify(updated));

      // Clear currentUser if the deleted candidate is logged in
      const currentUserStr = localStorage.getItem('currentUser');
      if (currentUserStr) {
        const curr = JSON.parse(currentUserStr);
        if (curr.id === candidateId) {
          localStorage.removeItem('currentUser');
        }
      }

      // 2. Delete from Supabase ONLY if it is a valid UUID
      const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(candidateId);
      if (isUUID) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', candidateId);

        if (error) {
          console.error("Supabase profile deletion error:", error);
        }
      } else {
        console.warn(`Skipped Supabase delete: ${candidateId} is an offline local ID.`);
      }

      fetchCandidates();
      alert("Candidate deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete candidate.");
    }
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      // PRIMARY SOURCE: Supabase — shows candidates from ALL devices/laptops
      const { data: supabaseData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'candidate')
        .order('created_at', { ascending: false });

      // Clean up duplicates from localStorage
      const localCandidates: any[] = JSON.parse(localStorage.getItem('allCandidates') || '[]');
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
      if (uniqueLocal.length !== localCandidates.length) {
        localStorage.setItem('allCandidates', JSON.stringify(uniqueLocal));
      }

      let mergedList: any[] = [];

      if (supabaseData && !error && supabaseData.length > 0) {
        // ✅ Supabase has data — use it as the master list
        // Enrich data with status since the profiles table doesn't have a status column
        const enrichedSupabase = supabaseData.map((c: any) => ({
          ...c,
          status: c.status || (c.exam_slot ? 'Approved' : 'Pending')
        }));

        const supabaseIds = new Set(enrichedSupabase.map((c: any) => c.id));
        const supabaseEmails = new Set(enrichedSupabase.map((c: any) => c.email?.toLowerCase().trim()));
        const offlineOnly = uniqueLocal.filter((c: any) => {
          const isLocalCandidate = c.role === 'candidate';
          const inSupabase = supabaseIds.has(c.id) || (c.email && supabaseEmails.has(c.email.toLowerCase().trim()));
          return isLocalCandidate && !inSupabase;
        });
        mergedList = [...enrichedSupabase, ...offlineOnly];
      } else {
        if (error) {
          console.warn('Supabase fetch error, falling back to localStorage:', error.message);
        }
        mergedList = [...uniqueLocal].reverse();
      }

      // Deduplicate the final merged list by email
      const finalSeen = new Set<string>();
      const finalUnique: any[] = [];
      mergedList.forEach((c: any) => {
        const emailKey = c.email?.toLowerCase().trim();
        if (emailKey) {
          if (!finalSeen.has(emailKey)) {
            finalSeen.add(emailKey);
            finalUnique.push(c);
          } else {
            // If already seen, prefer the one that has an exam slot or is from Supabase
            const existingIdx = finalUnique.findIndex(x => x.email?.toLowerCase().trim() === emailKey);
            if (existingIdx !== -1) {
              const existing = finalUnique[existingIdx];
              const existingIsOffline = typeof existing.id === 'string' && existing.id.startsWith('AE-');
              const currentIsOffline = typeof c.id === 'string' && c.id.startsWith('AE-');
              
              if (existingIsOffline && !currentIsOffline) {
                // Current is Supabase, replace offline
                finalUnique[existingIdx] = c;
              } else if (existingIsOffline === currentIsOffline && !existing.exam_slot && c.exam_slot) {
                // Keep the scheduled one
                finalUnique[existingIdx] = c;
              }
            }
          }
        } else {
          finalUnique.push(c);
        }
      });

      setCandidates(finalUnique);
    } catch (err) {
      console.error('Candidate fetch failed:', err);
      const localCandidates: any[] = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      setCandidates([...localCandidates].reverse());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();

    const channel = supabase
      .channel('reg-sync-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchCandidates)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleExportCSV = () => {
    const csvRows = [
      ['Registration ID', 'Full Name', 'Email Address', 'Mobile Number', 'ID Proof Type', 'ID Proof Number', 'City', 'State', 'Exam Slot', 'Signed Up At']
    ];

    filteredCandidates.forEach(cand => {
      const examSlotStr = cand.exam_slot ? new Date(cand.exam_slot).toLocaleString() : 'Not Scheduled';
      csvRows.push([
        getApxId(cand.id),
        cand.full_name || '',
        cand.email || '',
        cand.mobile || '',
        cand.id_proof_type || 'Aadhar Card',
        cand.id_proof_number || '',
        cand.city || '',
        cand.state || '',
        examSlotStr,
        new Date(cand.created_at).toLocaleString()
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Aptitude_Edge_Registrations.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateCandidateLocal = (candidateId: string, updates: any) => {
    const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
    const updatedCandidates = localCandidates.map((c: any) => {
      if (c.id === candidateId) {
        return { ...c, ...updates };
      }
      return c;
    });
    localStorage.setItem('allCandidates', JSON.stringify(updatedCandidates));

    // Also update currentUser if it's the same logged-in user
    try {
      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (currentUser && currentUser.id === candidateId) {
        localStorage.setItem('currentUser', JSON.stringify({ ...currentUser, ...updates }));
      }
    } catch (e) {
      console.error("Error updating local currentUser:", e);
    }
  };

  const handleAccept = async (candidateId: string) => {
    console.log("HANDLE ACCEPT RUNNING", candidateId);
    // Schedule 5.5 hours from now
    let scheduledDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const hour = scheduledDate.getHours();
    
    if (hour < 9) {
      // Too early! Move to 9:00 AM of the same day
      scheduledDate.setHours(9, 0, 0, 0);
    } else if (hour >= 21) {
      // Too late! Move to 9:00 AM of the next day
      scheduledDate.setDate(scheduledDate.getDate() + 1);
      scheduledDate.setHours(9, 0, 0, 0);
    }
    
    const scheduledTime = scheduledDate.toISOString();
    
    // Find candidate details first
    const candidate = candidates.find(c => c.id === candidateId);
    
    // Update local storage
    const updates = {
      status: 'Approved',
      exam_slot: scheduledTime
    };
    updateCandidateLocal(candidateId, updates);

    // Update Supabase profiles table ONLY if candidateId is a valid UUID
    try {
      const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(candidateId);
      if (isUUID) {
        const { error } = await supabase
          .from('profiles')
          .update({
            status: 'Approved',
            exam_slot: scheduledTime
          })
          .eq('id', candidateId);

        if (error) {
          console.error("Supabase exam_slot update failed:", error);
        }
      } else {
        console.warn(`Skipped Supabase update: ${candidateId} is an offline local ID.`);
      }
    } catch (err) {
      console.error("Supabase update error:", err);
    }

    // Refresh candidate list
    fetchCandidates();
  };
    

  const handleReject = async (candidateId: string) => {
    // Update local storage
    const updates = {
      status: 'Rejected',
      exam_slot: null
    };
    updateCandidateLocal(candidateId, updates);

    // Update Supabase profiles table ONLY if candidateId is a valid UUID
    try {
      const isUUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(candidateId);
      if (isUUID) {
        const { error } = await supabase
          .from('profiles')
          .update({
            exam_slot: null
          })
          .eq('id', candidateId);

        if (error) {
          console.error("Supabase reject update failed:", error);
        }
      } else {
        console.warn(`Skipped Supabase reject: ${candidateId} is an offline local ID.`);
      }
    } catch (err) {
      console.error("Supabase update error:", err);
    }

    // Refresh candidate list
    fetchCandidates();
  };

  const filteredCandidates = candidates.filter(c => 
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.id_proof_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    getApxId(c.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={styles.tableContainer}>
      {/* Source banner — tells admin data comes from Supabase cloud */}
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
        Showing ALL registered candidates from Supabase cloud database — includes registrations from any laptop
        <button
          onClick={fetchCandidates}
          disabled={loading}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '1px solid #86efac', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}
          title="Re-fetch latest data from Supabase"
        >
          <RefreshCw size={13} className={loading ? regStyles.spinning : ''} /> {loading ? 'Syncing...' : 'Refresh'}
        </button>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search by name, email, or ID number..." 
            className={styles.searchInput}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.actionGroup}>
          <button className={styles.btnPrimary} onClick={fetchCandidates} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: loading ? 0.7 : 1 }}>
            <RefreshCw size={14} className={loading ? regStyles.spinning : ''} /> Sync Cloud
          </button>
          <button className={styles.btnPrimary} onClick={handleExportCSV} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Reg ID</th>
              <th>Candidate Name</th>
              <th>Exam Scheduled</th>
              <th>Status</th>
              <th>Signed Up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <RefreshCw size={28} style={{ animation: 'spin 1s linear infinite', color: '#008F8C' }} />
                  <span>Fetching candidates from Supabase cloud...</span>
                </div>
              </td></tr>
            ) : filteredCandidates.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <User size={32} style={{ color: '#cbd5e1' }} />
                  <strong style={{ color: '#334155' }}>No registered candidates yet</strong>
                  <span style={{ fontSize: '0.85rem' }}>When candidates register from any device, they will appear here automatically.</span>
                  <button onClick={fetchCandidates} style={{ marginTop: '8px', padding: '8px 20px', background: '#008F8C', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RefreshCw size={14} /> Try Again
                  </button>
                </div>
              </td></tr>
            ) : filteredCandidates.map((reg) => (
              <tr key={reg.id}>
                <td><strong>{getApxId(reg.id)}</strong></td>
                <td>
                  <div className={styles.userCell}>
                    <strong>{reg.full_name}</strong>
                    <span>{reg.email} | {reg.mobile || 'No Mobile'}</span>
                  </div>
                </td>
                <td>
                  <span className={regStyles.sectionBadge}>
                    {reg.exam_slot ? new Date(reg.exam_slot).toLocaleDateString() : 'Not Scheduled'}
                  </span>
                </td>
                <td>
                  <span className={`${styles.badge} ${
                    (reg.status || 'Pending') === 'Approved' ? styles.badgeSuccess : 
                    (reg.status || 'Pending') === 'Rejected' ? styles.badgeDanger : 
                    styles.badgeWarning
                  }`}>
                    {reg.status || 'Pending'}
                  </span>
                </td>
                <td>{new Date(reg.created_at).toLocaleDateString()}</td>
                <td style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    className={styles.btnOutline} 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }} 
                    title="View Profile Details"
                    onClick={() => setSelectedCandidate(reg)}
                  >
                    <Eye size={14} /> Details
                  </button>
                  <button 
                    className={styles.btnOutline} 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', borderColor: '#0ea5e9', color: '#0ea5e9' }} 
                    title="Edit Candidate Profile"
                    onClick={() => handleStartEditCandidate(reg)}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button 
                    className={styles.btnOutline} 
                    style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', borderColor: '#ef4444', color: '#ef4444' }} 
                    title="Delete Candidate"
                    onClick={() => handleDeleteCandidate(reg.id)}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                  {(reg.status || 'Pending') === 'Pending' && (
                    <>
                      <button 
                        className={styles.btnPrimary} 
                        style={{ padding: '0.4rem 0.8rem', background: '#22c55e', color: 'white', fontSize: '0.85rem', fontWeight: 'bold', border: 'none', borderRadius: '6px', cursor: 'pointer' }} 
                        onClick={() => handleAccept(reg.id)}
                      >
                        Accept
                      </button>
                      <button 
                        className={styles.btnOutline} 
                        style={{ padding: '0.4rem 0.8rem', borderColor: '#ef4444', color: '#ef4444', fontSize: '0.85rem', fontWeight: 'bold', borderRadius: '6px', cursor: 'pointer' }} 
                        onClick={() => handleReject(reg.id)}
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Candidate Profile Details Drawer / Modal */}
      {selectedCandidate && (
        <div className={regStyles.modalOverlay}>
          <div className={regStyles.modalContent}>
            <div className={regStyles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={20} style={{ color: 'var(--primary)' }} />
                <h2>Candidate Profile Card</h2>
              </div>
              <button className={regStyles.closeBtn} onClick={() => setSelectedCandidate(null)}>
                <X size={20} />
              </button>
            </div>
            
            <div className={regStyles.modalBody}>
              <div className={regStyles.profileHero}>
                <div className={regStyles.avatarMockup}>
                  {selectedCandidate.full_name?.charAt(0) || 'C'}
                </div>
                <div className={regStyles.profileNameDetails}>
                  <h3>{selectedCandidate.full_name}</h3>
                  <span>Candidate ID: {getApxId(selectedCandidate.id)}</span>
                </div>
              </div>

              <div className={regStyles.detailsGrid}>
                <div className={regStyles.detailCard}>
                  <span>Email Address</span>
                  <strong>{selectedCandidate.email}</strong>
                </div>

                <div className={regStyles.detailCard}>
                  <span>Mobile Phone</span>
                  <strong>{selectedCandidate.mobile || 'Not provided'}</strong>
                </div>

                <div className={regStyles.detailCard}>
                  <span>ID Proof Details</span>
                  <strong>{selectedCandidate.id_proof_type || 'Aadhar Card'} ({selectedCandidate.id_proof_number || 'N/A'})</strong>
                </div>

                <div className={regStyles.detailCard}>
                  <span>Exam Slot Selection</span>
                  <strong>{selectedCandidate.exam_slot ? new Date(selectedCandidate.exam_slot).toLocaleString() : 'Not scheduled yet'}</strong>
                </div>

                <div className={regStyles.detailCard}>
                  <span>Current Location</span>
                  <strong>{selectedCandidate.city || 'N/A'}, {selectedCandidate.state || 'N/A'}</strong>
                </div>

                <div className={regStyles.detailCard}>
                  <span>Registration Timestamp</span>
                  <strong>{new Date(selectedCandidate.created_at).toLocaleString()}</strong>
                </div>
              </div>

               <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)' }}>UPLOADED SECURITY ASSETS</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Webcam Selfie Photo</span>
                    <p style={{ margin: '5px 0 0 0', fontWeight: 700, color: selectedCandidate.id_photo_url ? '#16a34a' : '#ea580c', fontSize: '0.85rem' }}>
                      {selectedCandidate.id_photo_url ? '✓ Photo Uploaded' : '✗ Pending Selfie Capture'}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Aadhaar Card Copy</span>
                    <p style={{ margin: '5px 0 0 0', fontWeight: 700, color: selectedCandidate.id_proof_number ? '#16a34a' : '#ea580c', fontSize: '0.85rem' }}>
                      {selectedCandidate.id_proof_number ? '✓ ID Scan Complete' : '✗ Pending Document scan'}
                    </p>
                  </div>
                </div>
              </div>

              {(selectedCandidate.status || 'Pending') === 'Pending' && (
                <div style={{ marginTop: '25px', display: 'flex', gap: '15px', justifyContent: 'flex-end' }}>
                  <button 
                    className={styles.btnPrimary} 
                    style={{ padding: '0.6rem 1.5rem', background: '#22c55e', color: 'white', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer' }} 
                    onClick={() => {
                      handleAccept(selectedCandidate.id);
                      setSelectedCandidate(null);
                    }}
                  >
                    Accept & Schedule
                  </button>
                  <button 
                    className={styles.btnOutline} 
                    style={{ padding: '0.6rem 1.5rem', borderColor: '#ef4444', color: '#ef4444', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }} 
                    onClick={() => {
                      handleReject(selectedCandidate.id);
                      setSelectedCandidate(null);
                    }}
                  >
                    Reject Candidate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Email Dispatch Success Notification Toast */}
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
                <strong style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0A3557' }}>Exam Slot Email Sent!</strong>
                <button 
                  onClick={() => setEmailStatus(null)} 
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', padding: '0 4px', display: 'flex', alignItems: 'center' }}
                >
                  <X size={16} />
                </button>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#475569', lineHeight: 1.4 }}>
                Exam slot notification successfully generated and dispatched to <strong>{emailStatus.email}</strong> for <strong>{emailStatus.candidateName}</strong>.
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
              <span style={{ fontWeight: 600, color: '#0f766e' }}>✉ Developer Demo Mailbox Available:</span>
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

      {editingCandidate && (
        <div className={regStyles.modalOverlay}>
          <div className={regStyles.modalContent} style={{ maxWidth: '500px' }}>
            <div className={regStyles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <User size={20} />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Edit Candidate: {getApxId(editingCandidate.id)}</h2>
              </div>
              <button className={regStyles.closeBtn} onClick={() => setEditingCandidate(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditCandidate} style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '20px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Full Name</label>
                <input 
                  type="text" 
                  className={styles.searchInput} 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={editFormData.fullName}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Email Address</label>
                <input 
                  type="email" 
                  className={styles.searchInput} 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Mobile Number</label>
                <input 
                  type="text" 
                  className={styles.searchInput} 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={editFormData.mobile}
                  onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value })}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>ID Type</label>
                  <select 
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', backgroundColor: 'white', boxSizing: 'border-box' }}
                    value={editFormData.idType}
                    onChange={(e) => setEditFormData({ ...editFormData, idType: e.target.value })}
                  >
                    <option>Aadhar Card</option>
                    <option>PAN Card</option>
                    <option>Passport</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>ID Number</label>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={editFormData.idNumber}
                    onChange={(e) => setEditFormData({ ...editFormData, idNumber: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>City</label>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={editFormData.city}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>State</label>
                  <input 
                    type="text" 
                    className={styles.searchInput} 
                    style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                    value={editFormData.state}
                    onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Exam Slot (Date & Time)</label>
                <input 
                  type="datetime-local" 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', display: 'block', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  value={editFormData.examSlot}
                  onChange={(e) => setEditFormData({ ...editFormData, examSlot: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className={styles.btnOutline} onClick={() => setEditingCandidate(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#008F8C', color: 'white' }}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
