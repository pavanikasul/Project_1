'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Upload, FileText, CheckCircle, AlertCircle, Edit3, Trash2 } from 'lucide-react';
import styles from './page.module.css';

export default function QuestionsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);

  const handleUpload = () => {
    if (!file) return;
    setIsParsing(true);
    // Mock parsing delay
    setTimeout(() => {
      setQuestions([
        { id: 1, text: "Sample Question 1", type: "MCQ", options: ["A", "B", "C", "D"], answer: "A" },
        { id: 2, text: "Sample Question 2", type: "TF", options: ["True", "False"], answer: "True" },
      ]);
      setIsParsing(false);
    }, 2000);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Question Bank Management</h1>
      
      <div className={styles.uploadArea}>
        <div className={styles.dropzone}>
          <Upload size={48} className={styles.uploadIcon} />
          <h3>Upload Exam PDF</h3>
          <p>Drag and drop your PDF here or click to browse</p>
          <input 
            type="file" 
            accept=".pdf" 
            onChange={(e) => setFile(e.target.files?.[0] || null)} 
            className={styles.fileInput}
          />
          {file && <div className={styles.fileLabel}>{file.name}</div>}
        </div>
        <Button 
          onClick={handleUpload} 
          disabled={!file || isParsing}
          style={{ width: '100%', marginTop: '20px' }}
        >
          {isParsing ? 'Parsing Questions...' : 'Process PDF'}
        </Button>
      </div>

      {questions.length > 0 && (
        <div className={styles.previewArea}>
          <div className={styles.previewHeader}>
            <h2>Parsed Questions ({questions.length})</h2>
            <Button variant="outline" size="sm">Publish All</Button>
          </div>
          
          <div className={styles.questionList}>
            {questions.map((q) => (
              <div key={q.id} className={styles.qCard}>
                <div className={styles.qHeader}>
                  <span className={styles.qType}>{q.type}</span>
                  <div className={styles.qActions}>
                    <Button variant="outline" size="sm" className={styles.iconBtn}><Edit3 size={14} /></Button>
                    <Button variant="danger" size="sm" className={styles.iconBtn}><Trash2 size={14} /></Button>
                  </div>
                </div>
                <p className={styles.qText}>{q.text}</p>
                <div className={styles.options}>
                  {q.options.map((opt: string) => (
                    <div key={opt} className={styles.optItem}>
                      <div className={styles.optDot} /> {opt}
                    </div>
                  ))}
                </div>
                <div className={styles.correctAnswer}>
                  Correct Answer: <strong>{q.answer}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
