import React, { useState, useEffect } from 'react';
import { Shield, Key, Eye, EyeOff, HardDrive, Wifi, Cpu } from 'lucide-react';
import { setupVault, verifyVaultPassword } from '../services/crypto';
import { db } from '../db/database';

const SlateLogo = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" className="security-gate-logo" style={{ margin: '0 auto 16px', display: 'block' }}>
    {/* Background slate plate */}
    <rect x="8" y="14" width="32" height="32" rx="4" transform="rotate(-10 8 14)" fill="var(--text)" fillOpacity="0.15" stroke="var(--text)" strokeWidth="1.5" />
    {/* Foreground slate plate */}
    <rect x="16" y="10" width="32" height="32" rx="4" transform="rotate(-3 16 10)" fill="var(--text)" stroke="var(--text)" strokeWidth="1.5" />
    {/* The "S" character inside the foreground slate in beautiful Georgia/serif style */}
    <text x="32" y="30" fill="var(--bg)" fontSize="18" fontFamily="var(--font-serif)" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform="rotate(-3 32 30)">S</text>
  </svg>
);

const FeaturesExplanation = () => (
  <div className="security-gate-features">
    <h2 className="features-title">The Cryptographic Architecture</h2>
    <p className="features-subtitle">Slate is built on absolute privacy and trustless local-first engineering principles.</p>
    <div className="features-grid">
      <div className="feature-card">
        <div className="feature-icon"><HardDrive size={18} /></div>
        <div className="feature-content">
          <h3>Zero-Cloud Local-First</h3>
          <p>Your notes are stored on your device's IndexedDB. No external servers, no tracking, sub-100ms load times.</p>
        </div>
      </div>
      <div className="feature-card">
        <div className="feature-icon"><Shield size={18} /></div>
        <div className="feature-content">
          <h3>AES-GCM-256 Encryption</h3>
          <p>Unbreakable encryption. Keys are derived locally using PBKDF2 with 100,000 rounds of hashing.</p>
        </div>
      </div>
      <div className="feature-card">
        <div className="feature-icon"><Wifi size={18} /></div>
        <div className="feature-content">
          <h3>SSID-Bound Ghost Mode</h3>
          <p>Lock notes to specific physical coordinates. Notes only decrypt when connected to authorized Wi-Fi networks.</p>
        </div>
      </div>
      <div className="feature-card">
        <div className="feature-icon"><Cpu size={18} /></div>
        <div className="feature-content">
          <h3>Local Semantic Intelligence</h3>
          <p>Discover connecting thoughts offline. On-device Cosine Similarity connects notes without sharing data.</p>
        </div>
      </div>
    </div>
  </div>
);

interface SecurityGateProps {
  onUnlock: (key: CryptoKey, password: string) => void;
}

export const SecurityGate: React.FC<SecurityGateProps> = ({ onUnlock }) => {
  const [isNewUser, setIsNewUser] = useState<boolean>(true);
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [showResetModal, setShowResetModal] = useState<boolean>(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string>('');

  const [rememberPassword, setRememberPassword] = useState<boolean>(() => {
    const salt = localStorage.getItem('slate_vault_salt');
    if (salt) {
      return !!localStorage.getItem('slate_remembered_password');
    }
    return true;
  });

  // Check if a vault already exists
  useEffect(() => {
    const salt = localStorage.getItem('slate_vault_salt');
    const sentinel = localStorage.getItem('slate_vault_sentinel');
    const iv = localStorage.getItem('slate_vault_sentinel_iv');
    
    if (salt && sentinel && iv) {
      setIsNewUser(false);
      
      // Auto-unlock if there is a remembered password and not explicitly locked
      const remembered = localStorage.getItem('slate_remembered_password');
      const isExplicitLocked = sessionStorage.getItem('slate_explicit_locked') === 'true';
      
      if (remembered && !isExplicitLocked) {
        setIsVerifying(true);
        verifyVaultPassword(remembered, salt, sentinel, iv).then(derivedKey => {
          if (derivedKey) {
            onUnlock(derivedKey, remembered);
          } else {
            localStorage.removeItem('slate_remembered_password');
          }
        }).catch(err => {
          console.error('Auto-unlock error:', err);
          localStorage.removeItem('slate_remembered_password');
        }).finally(() => {
          setIsVerifying(false);
        });
      }
    } else {
      setIsNewUser(true);
    }
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsVerifying(true);
    try {
      const vault = await setupVault(password);
      
      // Save cryptographic parameters in localstorage
      localStorage.setItem('slate_vault_salt', vault.salt);
      localStorage.setItem('slate_vault_sentinel', vault.sentinel);
      localStorage.setItem('slate_vault_sentinel_iv', vault.sentinelIv);
      
      // Perform initial unlock
      const derivedKey = await verifyVaultPassword(
        password,
        vault.salt,
        vault.sentinel,
        vault.sentinelIv
      );
      
      if (derivedKey) {
        if (rememberPassword) {
          localStorage.setItem('slate_remembered_password', password);
        } else {
          localStorage.removeItem('slate_remembered_password');
        }
        sessionStorage.removeItem('slate_explicit_locked');
        onUnlock(derivedKey, password);
      } else {
        setError('Unexpected error during initialization. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to securely initialize your local database.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    const salt = localStorage.getItem('slate_vault_salt');
    const sentinel = localStorage.getItem('slate_vault_sentinel');
    const iv = localStorage.getItem('slate_vault_sentinel_iv');

    if (!salt || !sentinel || !iv) {
      setError('Local vault configuration is missing. Please reload.');
      setIsVerifying(false);
      return;
    }

    try {
      const derivedKey = await verifyVaultPassword(password, salt, sentinel, iv);
      if (derivedKey) {
        if (rememberPassword) {
          localStorage.setItem('slate_remembered_password', password);
        } else {
          localStorage.removeItem('slate_remembered_password');
        }
        sessionStorage.removeItem('slate_explicit_locked');
        onUnlock(derivedKey, password);
      } else {
        setError('Incorrect password. Failed to decrypt vault.');
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during vault decryption.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetVault = async () => {
    if (deleteConfirmation !== 'DELETE ALL') return;
    setIsVerifying(true);
    try {
      await db.notes.clear();
      localStorage.removeItem('slate_vault_salt');
      localStorage.removeItem('slate_vault_sentinel');
      localStorage.removeItem('slate_vault_sentinel_iv');
      localStorage.removeItem('slate_remembered_password');
      sessionStorage.removeItem('slate_explicit_locked');
      window.location.reload();
    } catch (err) {
      console.error('Failed to reset vault:', err);
      setError('Failed to clear database and reset vault.');
      setShowResetModal(false);
      setDeleteConfirmation('');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={styles.container} className="security-gate-container">
      <div className="security-gate-wrapper">
        {isNewUser && <FeaturesExplanation />}
        
        <div style={styles.lockBox} className="security-gate-box">
          <div style={styles.header}>
            <SlateLogo />
            <h1 style={styles.title}>{isNewUser ? 'Set Master Password' : 'Vault Locked'}</h1>
            <p style={styles.subtitle}>
              {isNewUser
                ? 'Create a master password to encrypt your workspace. Slate is fully offline with no cloud recovery. Please keep your password safe.'
                : 'Enter your password to derive keys and decrypt your local-first thoughts.'}
            </p>
          </div>

          <form onSubmit={isNewUser ? handleSetup : handleUnlock} style={styles.form}>
            <div style={styles.inputGroup}>
              <Key size={16} style={styles.inputIcon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Master Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={styles.input}
                required
                disabled={isVerifying}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {isNewUser && (
              <div style={styles.inputGroup}>
                <Key size={16} style={styles.inputIcon} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm Master Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  style={styles.input}
                  required
                  disabled={isVerifying}
                />
              </div>
            )}

            <div style={styles.rememberRow} className="security-gate-remember-row">
              <label style={styles.checkboxLabel} className="security-gate-checkbox-label">
                <input
                  type="checkbox"
                  checked={rememberPassword}
                  onChange={e => {
                    const val = e.target.checked;
                    setRememberPassword(val);
                    if (!val) {
                      localStorage.removeItem('slate_remembered_password');
                    }
                  }}
                  style={styles.checkbox}
                  disabled={isVerifying}
                  className="security-gate-checkbox"
                />
                <span>Remember password</span>
              </label>
            </div>

            {error && <div style={styles.errorContainer}>{error}</div>}

            <button type="submit" disabled={isVerifying} style={styles.submitButton}>
              {isVerifying ? 'Decrypting Vault...' : isNewUser ? 'Initialize Vault' : 'Unlock Slate'}
            </button>
          </form>

          {!isNewUser && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              style={styles.resetButton}
              className="security-gate-reset-trigger"
            >
              Reset Vault & Start Fresh
            </button>
          )}

          <div style={styles.footer}>
            <span style={styles.secureDot} /> Secured offline via AES-GCM-256
          </div>
        </div>
      </div>

      {showResetModal && (
        <div style={styles.modalOverlay} className="reset-modal-overlay">
          <div style={styles.modalContent} className="reset-modal-content">
            <h2 style={styles.modalTitle}>Destructive Vault Reset</h2>
            <p style={styles.modalText}>
              Warning: This action will <strong>permanently delete all your encrypted notes</strong> stored in the local IndexedDB database.
            </p>
            <p style={styles.modalTextSub}>
              This action is completely irreversible. There are no backups or cloud servers from which to retrieve your data.
            </p>
            
            <div style={styles.modalInputGroup}>
              <label style={styles.modalInputLabel}>
                Type <strong>DELETE ALL</strong> to authorize the reset:
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={e => setDeleteConfirmation(e.target.value)}
                placeholder="DELETE ALL"
                style={styles.modalInput}
                className="reset-modal-input"
                autoFocus
              />
            </div>

            <div style={styles.modalButtons}>
              <button
                type="button"
                onClick={() => {
                  setShowResetModal(false);
                  setDeleteConfirmation('');
                }}
                style={styles.modalCancelButton}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetVault}
                disabled={deleteConfirmation !== 'DELETE ALL'}
                style={{
                  ...styles.modalConfirmButton,
                  opacity: deleteConfirmation === 'DELETE ALL' ? 1 : 0.5,
                  cursor: deleteConfirmation === 'DELETE ALL' ? 'pointer' : 'not-allowed',
                }}
              >
                Permanently Delete Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100vw',
    height: '100vh',
    overflowY: 'auto',
    backgroundColor: 'var(--bg)',
    fontFamily: 'var(--font-sans)',
  },
  lockBox: {
    width: '100%',
    maxWidth: '440px',
    padding: '40px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    textAlign: 'center',
    animation: 'slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    marginBottom: '32px',
  },
  lockIcon: {
    color: 'var(--text)',
    marginBottom: '16px',
    animation: 'pulseGlow 2.5s infinite',
    borderRadius: '50%',
    padding: '4px',
  },
  alertIcon: {
    color: '#ef4444',
    marginBottom: '16px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  inputGroup: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: '12px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 40px 12px 36px',
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--code-bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    outline: 'none',
  },
  eyeButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    fontSize: '12px',
    color: '#ef4444',
    textAlign: 'left',
    padding: '8px 12px',
    borderRadius: '4px',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    border: '1px solid rgba(239, 68, 68, 0.15)',
    lineHeight: '1.4',
  },
  submitButton: {
    padding: '12px',
    fontSize: '14px',
    fontWeight: 500,
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  footer: {
    marginTop: '32px',
    fontSize: '11px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  secureDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: 'var(--text-muted)',
    display: 'inline-block',
  },
  rememberRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: '2px 4px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    userSelect: 'none',
  },
  checkbox: {
    accentColor: 'var(--text)',
    cursor: 'pointer',
    width: '14px',
    height: '14px',
  },
  resetButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '12px',
    cursor: 'pointer',
    marginTop: '16px',
    textDecoration: 'underline',
    fontFamily: 'var(--font-sans)',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: '24px',
  },
  modalContent: {
    width: '100%',
    maxWidth: '440px',
    padding: '32px',
    borderRadius: '12px',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    textAlign: 'left',
    animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: '#ef4444',
    marginBottom: '12px',
    letterSpacing: '-0.02em',
  },
  modalText: {
    fontSize: '13px',
    color: 'var(--text)',
    lineHeight: '1.5',
    marginBottom: '8px',
  },
  modalTextSub: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    marginBottom: '20px',
  },
  modalInputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
  },
  modalInputLabel: {
    fontSize: '12px',
    color: 'var(--text)',
  },
  modalInput: {
    padding: '10px 12px',
    fontSize: '14px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'var(--code-bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    outline: 'none',
    width: '100%',
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  },
  modalCancelButton: {
    padding: '10px 16px',
    fontSize: '13px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  modalConfirmButton: {
    padding: '10px 16px',
    fontSize: '13px',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
  },
};
export default SecurityGate;
