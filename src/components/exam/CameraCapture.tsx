'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Camera, RefreshCw, Check } from 'lucide-react';
import styles from './CameraCapture.module.css';

interface CameraCaptureProps {
  onCapture: (blob: Blob) => void;
  label: string;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, label }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) videoRef.current.srcObject = mediaStream;
      setError(null);
    } catch (err) {
      setError("Camera access denied or not found.");
      console.error(err);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setCapturedImage(url);
            onCapture(blob);
          }
        }, 'image/jpeg');
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <div className={styles.container}>
      <p className={styles.label}>{label}</p>
      
      <div className={styles.viewport}>
        {capturedImage ? (
          <img src={capturedImage} alt="Captured" className={styles.preview} />
        ) : (
          <video ref={videoRef} autoPlay playsInline className={styles.video} />
        )}
        
        {error && <div className={styles.error}>{error}</div>}
      </div>

      <div className={styles.controls}>
        {!capturedImage ? (
          <Button onClick={capture} disabled={!!error}>
            <Camera size={18} style={{ marginRight: '8px' }} />
            Capture Photo
          </Button>
        ) : (
          <Button variant="outline" onClick={retake}>
            <RefreshCw size={18} style={{ marginRight: '8px' }} />
            Retake
          </Button>
        )}
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};
