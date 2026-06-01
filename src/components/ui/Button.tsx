import React from 'react';
import clsx from 'clsx';
import styles from './Button.module.css';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className, 
  ...props 
}) => {
  return (
    <button 
      type={props.type || 'button'}
      className={clsx(styles.button, styles[variant], styles[size], className)} 
      {...props}
      suppressHydrationWarning
    >
      {children}
    </button>
  );
};
