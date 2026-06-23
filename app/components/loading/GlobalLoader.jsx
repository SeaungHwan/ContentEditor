"use client";

import styles from './GlobalLoader.module.css';

const GlobalLoader = () => {
  return (
    <div className={styles.loaderOverlay}>
      <div className={styles.spinner}>
        {Array.from({ length: 12 }).map((_, i) => (
          <span key={i} className={styles.bar} style={{ '--i': i }} />
        ))}
      </div>
    </div>
  );
};

export default GlobalLoader;
