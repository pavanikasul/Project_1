'use client';

import React, { useEffect, useState } from 'react';
import { Search, Filter, ShieldAlert, FileText, Check, Edit2, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import styles from '../table.module.css';

export default function ViolationsPage() {
  const [violations, setViolations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingViolation, setEditingViolation] = useState<any | null>(null);
  const [editVForm, setEditVForm] = useState({
    type: '',
    details: ''
  });

  const getViolationApxId = (vItem: any) => {
    let candidateId = vItem.submissions?.id;
    const name = vItem.submissions?.profiles?.full_name || 'Anonymous';
    
    const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');
    const candidate = localCandidates.find((c: any) => 
      (c.fullName || c.full_name || '').toLowerCase() === name.toLowerCase()
    );
    if (candidate && candidate.id) {
      candidateId = candidate.id;
    }
    
    const sorted = [...localCandidates].sort((a: any, b: any) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;
      return (a.email || '').localeCompare(b.email || '');
    });
    
    const targetCandidate = localCandidates.find((c: any) => c.id === candidateId);
    const targetEmail = targetCandidate?.email;

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

  // Enrich a local violation object so the name always resolves from the stored data
  const enrichLocalViolation = (v: any): any => {
    const localCandidates = JSON.parse(localStorage.getItem('allCandidates') || '[]');

    // Name already stored correctly in the nested structure
    let resolvedName =
      v.submissions?.profiles?.full_name ||
      v.candidateName ||
      v.name ||
      null;

    // If name is still missing, try matching by candidateId / submissionId
    if (!resolvedName) {
      const match = localCandidates.find(
        (c: any) => c.id === v.submissions?.id || c.id === v.candidate_id
      );
      if (match) resolvedName = match.full_name || match.fullName;
    }

    return {
      ...v,
      submissions: {
        ...(v.submissions || {}),
        profiles: {
          ...(v.submissions?.profiles || {}),
          full_name: resolvedName || 'Unknown Candidate'
        }
      }
    };
  };

  const deduplicateLocalVols = (vols: any[]) => {
    let hasDuplicates = false;
    const seenIds = new Set();
    const cleaned = vols.map((v: any, index: number) => {
      if (!v.id || seenIds.has(v.id)) {
        hasDuplicates = true;
        return {
          ...v,
          id: v.id
            ? `${v.id}-${index}-${Math.random().toString(36).substr(2, 4)}`
            : `V-${Date.now()}-${index}`
        };
      }
      seenIds.add(v.id);
      return v;
    });
    if (hasDuplicates) {
      localStorage.setItem('allViolations', JSON.stringify(cleaned));
    }
    return cleaned;
  };

  const fetchViolations = async () => {
    try {
      const { data, error } = await supabase
        .from('violations')
        .select(`
          id,
          type,
          details,
          timestamp,
          submissions (
            id,
            profiles ( full_name )
          )
        `)
        .order('timestamp', { ascending: false });

      if (data && data.length > 0 && !error) {
        setViolations(data);
      } else {
        const localVols = JSON.parse(localStorage.getItem('allViolations') || '[]');
        const cleaned = deduplicateLocalVols(localVols);
        setViolations(cleaned.reverse().map(enrichLocalViolation));
      }
    } catch (err) {
      console.error(err);
      const localVols = JSON.parse(localStorage.getItem('allViolations') || '[]');
      const cleaned = deduplicateLocalVols(localVols);
      setViolations(cleaned.reverse().map(enrichLocalViolation));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchViolations();

    const channel = supabase
      .channel('violation-monitor')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, fetchViolations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleStartEditViolation = (v: any) => {
    setEditingViolation(v);
    setEditVForm({
      type: v.type || '',
      details: v.details || ''
    });
  };

  const handleSaveEditViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingViolation) return;

    try {
      // 1. Update local storage
      const existingVols = JSON.parse(localStorage.getItem('allViolations') || '[]');
      const updated = existingVols.map((v: any) => {
        if (v.id === editingViolation.id) {
          return {
            ...v,
            type: editVForm.type,
            details: editVForm.details
          };
        }
        return v;
      });
      localStorage.setItem('allViolations', JSON.stringify(updated));

      // 2. Update Supabase
      const { error } = await supabase
        .from('violations')
        .update({
          type: editVForm.type,
          details: editVForm.details
        })
        .eq('id', editingViolation.id);

      if (error) {
        console.error("Supabase violation edit error:", error);
      }

      setEditingViolation(null);
      fetchViolations();
      alert("Violation log updated successfully!");
    } catch (err) {
      console.error(err);
      alert("An error occurred while saving violation details.");
    }
  };

  const handleDeleteViolation = async (violationId: string) => {
    if (!window.confirm("Are you sure you want to delete this violation record? This action cannot be undone.")) {
      return;
    }

    try {
      // 1. Delete from local storage
      const existingVols = JSON.parse(localStorage.getItem('allViolations') || '[]');
      const updated = existingVols.filter((v: any) => v.id !== violationId);
      localStorage.setItem('allViolations', JSON.stringify(updated));

      // 2. Delete from Supabase
      const { error } = await supabase
        .from('violations')
        .delete()
        .eq('id', violationId);

      if (error) {
        console.error("Supabase violation delete error:", error);
      }

      fetchViolations();
      alert("Violation log deleted successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to delete violation log.");
    }
  };

  return (
    <div className={styles.tableContainer}>
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={18} className={styles.searchIcon} />
          <input type="text" placeholder="Search violation logs..." className={styles.searchInput} />
        </div>
        <div className={styles.actionGroup}>
          <button className={styles.btnOutline}><Filter size={16} /> Severity: All</button>
          <button className={styles.btnOutline}><FileText size={16} /> Export Logs</button>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Log ID</th>
              <th>Candidate Info</th>
              <th>Violation Type</th>
              <th>Severity / Notes</th>
              <th>Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>Loading real violations...</td></tr>
            ) : violations.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center' }}>No violations found in the database!</td></tr>
            ) : violations.map((v, idx) => (
              <tr key={`${v.id}-${idx}`}>
                <td><strong>{getViolationApxId(v)}</strong></td>
                <td>
                  <div className={styles.userCell}>
                    <strong>{v.submissions?.profiles?.full_name || 'Unknown Candidate'}</strong>
                    <span>SID: {getViolationApxId(v)}</span>
                  </div>
                </td>
                <td>{v.type}</td>
                <td>
                  <div className={styles.userCell}>
                    <span className={`${styles.badge} ${styles.badgeDanger}`} style={{ width: 'fit-content' }}>
                      <ShieldAlert size={12} style={{ marginRight: '4px' }} /> High
                    </span>
                    <span style={{ marginTop: '6px' }}>{v.details || 'Suspicious activity flagged'}</span>
                  </div>
                </td>
                <td>{new Date(v.timestamp).toLocaleString()}</td>
                <td>
                  <div className={styles.actionGroup} style={{ display: 'flex', gap: '6px' }}>
                    <button className={styles.btnOutline} style={{ padding: '0.4rem' }} title="Resolve">
                      <Check size={16} color="#16a34a" />
                    </button>
                    <button 
                      className={styles.btnOutline} 
                      style={{ padding: '0.4rem', borderColor: '#0ea5e9', color: '#0ea5e9' }} 
                      title="Edit Log Notes"
                      onClick={() => handleStartEditViolation(v)}
                    >
                      <Edit2 size={15} />
                    </button>
                    <button 
                      className={styles.btnOutline} 
                      style={{ padding: '0.4rem', borderColor: '#ef4444', color: '#ef4444' }} 
                      title="Delete Log"
                      onClick={() => handleDeleteViolation(v.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editingViolation && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white', borderRadius: '12px', width: '450px', padding: '24px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldAlert size={20} color="#ef4444" />
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Edit Violation Notes</h2>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }} onClick={() => setEditingViolation(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveEditViolation} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Violation Type</label>
                <input 
                  type="text" 
                  className={styles.searchInput} 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
                  value={editVForm.type}
                  onChange={(e) => setEditVForm({ ...editVForm, type: e.target.value })}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '6px' }}>Severity / Note Details</label>
                <textarea 
                  style={{ width: '100%', border: '1px solid #cbd5e1', padding: '10px', borderRadius: '6px', height: '100px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  value={editVForm.details}
                  onChange={(e) => setEditVForm({ ...editVForm, details: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className={styles.btnOutline} onClick={() => setEditingViolation(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#008F8C', color: 'white' }}>Save Notes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
