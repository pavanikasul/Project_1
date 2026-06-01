'use client';
import React from 'react';
import styles from '../table.module.css';
export default function SettingsPage() {
  return (
    <div className={styles.tableContainer} style={{ padding: '3rem', textAlign: 'center' }}>
      <h2>System Settings</h2>
      <p style={{ color: '#64748b', marginTop: '1rem' }}>Configure API endpoints, AI proctoring strictness, and organization details.</p>
    </div>
  );
}
