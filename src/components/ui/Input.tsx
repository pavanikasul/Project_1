import React from 'react';
import clsx from 'clsx';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className, ...props }) => {
  return (
    <div className={clsx(styles.container, className)}>
      {label && <label className={styles.label}>{label}</label>}
      <input 
        className={clsx(styles.input, error && styles.inputError)} 
        {...props} 
        suppressHydrationWarning
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};
