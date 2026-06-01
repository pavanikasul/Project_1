import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import localExamSets from '@/data/examSets.json';
import styles from './ExamSetList.module.css';

export default function ExamSetList() {
  const [sets, setSets] = useState<Array<{ id: string; name: string }>>(localExamSets);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api('/api/exam-sets')
      .then(data => setSets(data))
      .catch(err => {
        console.error('Failed to load exam sets', err);
        setError('Unable to load exam sets from API. Showing local fallback data.');
        setSets(localExamSets);
      });
  }, []);

  const addSet = async () => {
    const name = prompt('Enter a name for the new exam set (e.g., "Set 5")');
    if (!name) return;
    try {
      const newSet = await api('/api/exam-sets', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      setSets(prev => [...prev, newSet]);
    } catch (e) {
      alert('Error creating set: ' + (e as Error).message);
    }
  };

  return (
    <section className={styles.container}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Exam Sets</h2>
        <button className={styles.addBtn} onClick={addSet}>+ New Set</button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
      {sets.length === 0 ? (
        <div className={styles.empty}>No exam sets found yet.</div>
      ) : (
        <ul className={styles.list}>
          {sets.map(set => (
            <li key={set.id} className={styles.item}>
              <Link href={`/admin/exam-sets/${set.id}`}>{set.name}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
