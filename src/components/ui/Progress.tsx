import React from 'react';
import styles from './Progress.module.css';

interface ProgressProps {
  value: number; // 0 to 100
  color?: string;
}

export const Progress: React.FC<ProgressProps> = ({ value, color }) => {
  return (
    <div className={styles.container}>
      <div 
        className={styles.bar} 
        style={{ 
          width: `${value}%`,
          backgroundColor: color || 'var(--primary)'
        }}
      >
        <div className={styles.reflection} />
      </div>
    </div>
  );
};
