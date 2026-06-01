'use client';
import React from 'react';
import styles from '../table.module.css';
export default function ReportsPage() {
  return (
    <div className={styles.tableContainer} style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>Advanced Reports & Analytics</h2>
      <p style={{ color: '#64748b', marginTop: '1rem' }}>Generate custom PDF and CSV reports across all exams and batches.</p>
    </div>
  );
}
