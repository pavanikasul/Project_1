import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Shield, Video, Clock, BarChart3, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <Image 
            src="/apexium-logo-teal.png" 
            alt="Apexium Logo" 
            width={110} 
            height={60} 
            className={styles.logoImage}
            priority
          />
          <div className={styles.logoTextContainer}>
            <span className={styles.brandAptitude}>Aptitude</span>
            <span className={styles.brandEdge}>Edge</span>
          </div>
        </div>
        <nav className={styles.nav}>
          <Link href="/login" className={styles.navLink}>Sign In</Link>
          <Link href="/register">
            <button className="btn-primary">Register</button>
          </Link>
          <div className={styles.navDivider}></div>
          <Link href="/admin/login">
            <button className={styles.adminBtn}>
              <Shield size={16} /> Admin Portal
            </button>
          </Link>
        </nav>
      </header>

      <main className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>
            Secure Online Proctored Examination
          </div>
          <h1 className={styles.title}>
            Prove Your Aptitude.<br />
            <span className={styles.highlight}>Earn Your Opportunity.</span>
          </h1>
          <p className={styles.heroDesc}>
            AptitudeEdge is a fully proctored online exam platform trusted by leading HR teams.<br />
            One secure, fair, and transparent assessment for every candidate.
          </p>
          <div className={styles.ctaGroup}>
            <Link href="/register">
              <button className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                Register for the Exam <ArrowRight size={18} />
              </button>
            </Link>
            <Link href="/login">
              <button className="btn-outline">Already Registered? Sign In</button>
            </Link>
          </div>
          </div>

        <div className={styles.heroImageContainer}>
          <Image 
            src="/hero-aptitude.png" 
            alt="Online Exam Registration Open - Interview Assessment Banner" 
            width={1920} 
            height={800} 
            className={styles.heroImage}
            priority
          />
        </div>
      </main>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Built for Security & Fairness</h2>
          <p className={styles.sectionDesc}>Every feature designed to ensure an equal playing field.</p>
        </div>
        <div className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Video size={24} />
            </div>
            <h3>Live Video Proctoring</h3>
            <p>AI-assisted face detection and violation monitoring throughout your exam session.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Shield size={24} />
            </div>
            <h3>Tamper-Proof Security</h3>
            <p>Full-screen enforcement, tab-switch detection, and identity verification at every step.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <Clock size={24} />
            </div>
            <h3>60-Minute Timed Exam</h3>
            <p>Auto-submit on timer expiry. No extensions. Fair for every candidate.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>
              <BarChart3 size={24} />
            </div>
            <h3>Instant Results</h3>
            <p>Detailed score breakdown with correct answers and performance analytics.</p>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>How It Works</h2>
          <p className={styles.sectionDesc}>Four simple steps from registration to result.</p>
        </div>
        <div className={styles.stepsContainer}>
          <div className={styles.step}>
            <div className={styles.stepNumber}>01</div>
            <h3 className={styles.stepTitle}>Register & Verify</h3>
            <p className={styles.stepDesc}>Complete multi-step registration with OTP on mobile and email.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>02</div>
            <h3 className={styles.stepTitle}>System Check</h3>
            <p className={styles.stepDesc}>Verify camera, microphone, and internet speed before the exam.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>03</div>
            <h3 className={styles.stepTitle}>Identity Capture</h3>
            <p className={styles.stepDesc}>Webcam photo + ID document scan for biometric verification.</p>
          </div>
          <div className={styles.step}>
            <div className={styles.stepNumber}>04</div>
            <h3 className={styles.stepTitle}>Take the Exam</h3>
            <p className={styles.stepDesc}>15 questions across aptitude, reasoning, and quantitative ability.</p>
          </div>
        </div>
      </section>

      <footer className={styles.ctaFooter}>
        <h2>Ready to Take the Exam?</h2>
      </footer>
    </div>
  );
}
