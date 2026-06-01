
"use client";

import React, { useEffect, useState } from 'react';
import { Users, Activity, AlertTriangle, CheckCircle, Clock, ShieldAlert, MonitorSmartphone, EyeOff, UsersRound, UserPlus } from 'lucide-react';
import styles from './AdminDashboard.module.css';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({
    registered: 0,
    liveExams: 0,
    suspicious: 0,
    completed: 0,
    pending: 0
  });
  const [violationsList, setViolationsList] = useState<any[]>([]);

  const fetchDashboardData = async () => {
    try {
      // 1. Registered Candidates (Merge Supabase + Local)
      const { data: supaCands } = await supabase.from('profiles').select('email, exam_slot, status').eq('role', 'candidate');
      const supaEmails = new Set(supaCands?.map(c => c.email?.toLowerCase().trim()).filter(Boolean) || []);
      
      // 2. Live Exams (Merge Supabase + Local)
      const { data: supaLive } = await supabase.from('submissions').select('id').eq('status', 'ongoing');
      const supaLiveIds = new Set(supaLive?.map(s => s.id) || []);
      
      // 3. Suspicious Activities (Supabase or Local)
      const { count: susCount } = await supabase.from('violations').select('*', { count: 'exact', head: true });
      
      // 4. Completed
      const { count: compCount } = await supabase.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'submitted');
      
      // 5. Recent Violations feed
      const { data: vData } = await supabase
        .from('violations')
        .select(`id, type, details, timestamp, submissions ( profiles ( full_name ) )`)
        .order('timestamp', { ascending: false })
        .limit(4);

      const localCands = JSON.parse(localStorage.getItem('allCandidates') || '[]');
      const localLive = JSON.parse(localStorage.getItem('liveExams') || '{}');
      const localVols = JSON.parse(localStorage.getItem('allViolations') || '[]');
      const localScores = JSON.parse(localStorage.getItem('allSubmissions') || '[]');
// Load reschedule requests to exclude candidates who have a pending or any reschedule request
const localReschedules = JSON.parse(localStorage.getItem('rescheduleRequests') || '[]');
const rescheduleEmails = new Set(localReschedules.map((r: any) => r.email?.toLowerCase?.().trim()).filter(Boolean));

      // Calculate Merged Totals
      const uniqueLocalCands = localCands.filter((c: any) => c.email && !supaEmails.has(c.email.toLowerCase().trim()));
      const totalRegistered = (supaCands?.length || 0) + uniqueLocalCands.length;

      const supaPending = supaCands?.filter(c => c.status === 'Pending' || (!c.exam_slot && c.status !== 'Approved' && c.status !== 'Rejected')).length || 0;
      const localPending = uniqueLocalCands.filter((c: any) => (c.status || 'Pending') === 'Pending').length;
      const totalPending = supaPending + localPending;

      const uniqueLocalLive = Object.values(localLive).filter((l: any) => !supaLiveIds.has(l.id));
      const totalLive = (supaLive?.length || 0) + uniqueLocalLive.length;

      const totalSuspicious = (susCount && susCount > 0) ? susCount : localVols.length;
      
      const supaCompletedCount = (compCount && compCount > 0) ? compCount : 0;
      // Count locally stored submissions that have status 'submitted' (case‑insensitive)
      const localCompletedCount = (localScores || []).filter((s: any) => {
        const st = typeof s.status === 'string' ? s.status.toLowerCase() : '';
        return st === 'submitted';
      }).length;
      const totalCompleted = supaCompletedCount + localCompletedCount;

      setStats({
        registered: totalRegistered,
        liveExams: totalLive,
        suspicious: totalSuspicious,
        completed: totalCompleted,
        pending: totalPending
      });

      const getTimeAgo = (timestamp: string) => {
        const diff = Date.now() - new Date(timestamp).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins} mins ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours} hours ago`;
        return `${Math.floor(hours / 24)} days ago`;
      };

      const getIcon = (type: string) => {
        if (type.toLowerCase().includes('face')) return UsersRound;
        if (type.toLowerCase().includes('tab') || type.toLowerCase().includes('window')) return Activity;
        if (type.toLowerCase().includes('mobile') || type.toLowerCase().includes('phone')) return MonitorSmartphone;
        if (type.toLowerCase().includes('no face') || type.toLowerCase().includes('away')) return EyeOff;
        return ShieldAlert;
      };

      if (vData && vData.length > 0) {
        setViolationsList(vData.map((v: any) => ({
          id: v.id,
          name: v.submissions?.profiles?.full_name || 'Unknown Candidate',
          time: getTimeAgo(v.timestamp),
          type: v.type,
          severity: 'High', 
          status: 'Review Required',
          icon: getIcon(v.type)
        })));
      } else {
        const recentLocal = [...localVols].reverse().slice(0, 4);
        setViolationsList(recentLocal.map((v: any, i) => ({
          id: v.id || i,
          name: v.submissions?.profiles?.full_name || v.candidateName || v.name || 'Unknown Candidate',
          time: getTimeAgo(v.timestamp || new Date().toISOString()),
          type: v.type,
          severity: 'High',
          status: 'Review Required',
          icon: getIcon(v.type || '')
        })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setMounted(true);
    
    // Check auth properly: either adminAuth flag is true, or currentUser has admin role
    const adminAuth = localStorage.getItem('adminAuth') === 'true';
    let isRoleAdmin = false;
    
    try {
      const savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.role === 'admin') isRoleAdmin = true;
      }
    } catch (e) {}
    
    if (adminAuth || isRoleAdmin) {
      setIsAdmin(true);
    } else {
      // If layout.tsx hasn't redirected yet, we still set it to true to avoid a blank screen
      // since layout.tsx handles the actual protection and redirect.
      setIsAdmin(true);
    }

    fetchDashboardData();
    
    // Subscribe to realtime updates for accurate data
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchDashboardData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'violations' }, fetchDashboardData)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (!mounted || !isAdmin) return null;

  return (
    <section className={styles.adminSection}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Admin Control Center</h2>
            <p className={styles.subtitle}>Real-time monitoring and analytics overview</p>
          </div>
          <div className={styles.pulseIndicator}>
            <span className={styles.pulseDot}></span>
            Live System Active
          </div>
        </div>

        <div className={styles.gridCards}>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper} style={{ backgroundColor: '#e6f4f4', color: '#008F8C' }}>
                <Users size={24} />
              </div>
              <span className={styles.growthBadge}>+12.5%</span>
            </div>
            <h3 className={styles.cardValue}>{stats.registered.toLocaleString()}</h3>
            <p className={styles.cardLabel}>Registered Candidates</p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper} style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                <UserPlus size={24} />
              </div>
            </div>
            <h3 className={styles.cardValue} style={{ color: '#d97706' }}>{stats.pending.toLocaleString()}</h3>
            <p className={styles.cardLabel}>Pending Approvals</p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper} style={{ backgroundColor: '#eef2f6', color: '#0A3557' }}>
                <Activity size={24} />
              </div>
              <span className={styles.liveBadge}>Live</span>
            </div>
            <h3 className={styles.cardValue}>{stats.liveExams.toLocaleString()}</h3>
            <p className={styles.cardLabel}>Exams Running Live</p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper} style={{ backgroundColor: '#fff3f3', color: '#e11d48' }}>
                <AlertTriangle size={24} />
              </div>
            </div>
            <h3 className={styles.cardValue} style={{ color: '#e11d48' }}>{stats.suspicious.toLocaleString()}</h3>
            <p className={styles.cardLabel}>Suspicious Activities Detected</p>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.iconWrapper} style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                <CheckCircle size={24} />
              </div>
            </div>
            <h3 className={styles.cardValue}>{stats.completed.toLocaleString()}</h3>
            <p className={styles.cardLabel}>Completed Successfully</p>
          </div>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.violationsPanel}>
            <div className={styles.panelHeader}>
              <h3><ShieldAlert size={20} className={styles.panelIcon} /> Active Violations Feed</h3>
              <Link href="/admin/dashboard/violations" className={styles.viewAllBtn}>View All</Link>
            </div>
            <div className={styles.violationList}>
              {violationsList.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', padding: '2rem 0' }}>No active violations.</div>
              ) : violationsList.map(v => (
                <div key={v.id} className={styles.violationItem}>
                  <div className={styles.violationIcon}>
                    <v.icon size={20} />
                  </div>
                  <div className={styles.violationInfo}>
                    <h4>{v.name}</h4>
                    <p>{v.type}</p>
                  </div>
                  <div className={styles.violationMeta}>
                    <span className={styles.time}><Clock size={12} /> {v.time}</span>
                    <span className={`${styles.severityBadge} ${styles[v.severity.toLowerCase()]}`}>{v.severity}</span>
                  </div>
                  <div className={styles.violationStatus}>
                    {v.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className={styles.chartPanel}>
            <div className={styles.panelHeader}>
              <h3>Exam Status Overview</h3>
            </div>
            <div className={styles.chartMockup}>
              <div className={styles.chartBars}>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '80%' }}></div><span>Mon</span></div>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '65%' }}></div><span>Tue</span></div>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '90%' }}></div><span>Wed</span></div>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '40%' }}></div><span>Thu</span></div>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '75%' }}></div><span>Fri</span></div>
                <div className={styles.barContainer}><div className={styles.bar} style={{ height: '100%', backgroundColor: '#008F8C' }}></div><span style={{ fontWeight: 600 }}>Today</span></div>
              </div>
            </div>
            <div className={styles.recentActivity}>
              <h4>System Alerts</h4>
              <ul>
                <li>Server capacity scaled up automatically in AP-South.</li>
                <li>New proctoring rules updated for Aptitude Test V2.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
