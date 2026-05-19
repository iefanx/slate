import { useState, useEffect } from 'react';
import { Shield, Sparkles, AlertCircle, X } from 'lucide-react';

import { SecurityGate } from './components/SecurityGate';
import { Sidebar } from './components/Sidebar';
import { Workspace } from './components/Workspace';
import { CommandPalette } from './components/CommandPalette';
import { AmbientDiscovery } from './components/AmbientDiscovery';

import type { DecryptedNote, NoteContext } from './db/database';
import { 
  saveNote, 
  deleteNote, 
  getAllDecryptedNotes, 
  exportEncryptedBackup
} from './db/database';
import { hashString } from './services/crypto';
import { decompressTextFromUrl, generateShareUrl } from './services/compressor';
import { findSimilarNotes } from './services/similarity';
import { useBattery } from './hooks/useBattery';
import { useDebounce } from './hooks/useDebounce';

export default function App() {
  // Authentication & DB states
  const [cryptoKey, setCryptoKey] = useState<CryptoKey | null>(null);
  const [notes, setNotes] = useState<DecryptedNote[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);

  // Editor states
  const [editorContent, setEditorContent] = useState<string>('');
  const [isGhost, setIsGhost] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  
  // Environment states
  const [simulatedNetwork, setSimulatedNetwork] = useState<string>('Home Wi-Fi');
  const [simulatedNetworkHash, setSimulatedNetworkHash] = useState<string>('');
  const batteryState = useBattery();
  
  // Sidebar & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Overlay / Panel states
  const [isPaletteOpen, setIsPaletteOpen] = useState<boolean>(false);
  const [isDiscoveryOpen, setIsDiscoveryOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<'vintage' | 'oled'>('oled');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);

  // Stateless share previews
  const [sharingPreview, setSharingPreview] = useState<string | null>(null);

  // Similarity matches
  const [similarities, setSimilarities] = useState<{ id: string; score: number }[]>([]);

  // DEBOUNCERS
  const debouncedContentForSave = useDebounce(editorContent, 1000);
  const debouncedContentForSimilarity = useDebounce(editorContent, 300);

  // 1. Sync Monochromatic Themes
  useEffect(() => {
    const savedTheme = localStorage.getItem('slate_theme') as 'vintage' | 'oled';
    const activeTheme = savedTheme || 'oled';
    setTheme(activeTheme);
    if (activeTheme === 'oled') {
      document.body.classList.add('oled-theme');
    } else {
      document.body.classList.remove('oled-theme');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'vintage' ? 'oled' : 'vintage';
    setTheme(nextTheme);
    localStorage.setItem('slate_theme', nextTheme);
    if (nextTheme === 'oled') {
      document.body.classList.add('oled-theme');
    } else {
      document.body.classList.remove('oled-theme');
    }
  };

  // 2. Resolve simulated network hashes dynamically
  useEffect(() => {
    hashString(simulatedNetwork).then(hash => {
      setSimulatedNetworkHash(hash);
    });
  }, [simulatedNetwork]);

  // 3. Listen to Stateless Share Link router
  useEffect(() => {
    const checkShareHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#/share/')) {
        const payload = hash.substring(8);
        const decompressed = decompressTextFromUrl(payload);
        if (decompressed) {
          setSharingPreview(decompressed);
        }
      }
    };

    checkShareHash();
    window.addEventListener('hashchange', checkShareHash);
    return () => window.removeEventListener('hashchange', checkShareHash);
  }, []);

  // 4. Global Keyboard Hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle Command Palette (Cmd+/ or Ctrl+/)
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setIsPaletteOpen(prev => !prev);
      }
      
      // Fast manual save (Cmd+S or Ctrl+S)
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        triggerManualSave();
      }

      // New Note (Cmd+N or Ctrl+N)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }

      // Toggle Sidebar (Cmd+\ or Ctrl+\)
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') {
        e.preventDefault();
        setIsSidebarOpen(prev => !prev);
      }

      // Close overlays on Escape
      if (e.key === 'Escape') {
        setIsPaletteOpen(false);
        setIsDiscoveryOpen(false);
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cryptoKey, editorContent, isGhost, simulatedNetwork, simulatedNetworkHash, activeNoteId, batteryState]);

  // 5. Initial Decryption load upon successful Unlock
  const handleVaultUnlock = async (key: CryptoKey) => {
    setCryptoKey(key);
    
    try {
      const decrypted = await getAllDecryptedNotes(key);
      setNotes(decrypted);
    } catch (err) {
      console.error('Failed to load notes on unlock:', err);
    }
  };

  // 6. Monitor active note selection
  const handleSelectNote = (id: string | null) => {
    if (id === null) {
      handleNewNote();
      return;
    }

    const note = notes.find(n => n.id === id);
    if (note) {
      setActiveNoteId(id);
      setEditorContent(note.content);
      setIsGhost(note.is_ghost);
      setIsDirty(false);
      
      // Auto-close on mobile screens when selecting notes
      if (window.innerWidth < 900) {
        setIsSidebarOpen(false);
      }
    }
  };

  // 7. Initialize clean scratchpad canvas
  const handleNewNote = () => {
    // If current draft has content, auto-save should trigger first
    setActiveNoteId(null);
    setEditorContent('');
    setIsGhost(false);
    setIsDirty(false);
    
    // Auto-close on mobile screens when creating fresh canvas
    if (window.innerWidth < 900) {
      setIsSidebarOpen(false);
    }
  };

  // 8. Auto-Saving Loop (Triggered by debounced content changes)
  useEffect(() => {
    if (!cryptoKey || !debouncedContentForSave.trim()) return;

    // Check if anything has actually changed from the DB state
    if (activeNoteId) {
      const activeRecord = notes.find(n => n.id === activeNoteId);
      if (activeRecord && activeRecord.content === debouncedContentForSave && activeRecord.is_ghost === isGhost) {
        setIsDirty(false);
        return; // No changes, skip DB transaction
      }
    }

    const performAutoSave = async () => {
      const hour = new Date().getHours();
      let time_bucket: NoteContext['time_bucket'] = 'morning';
      if (hour >= 0 && hour < 5) time_bucket = 'deep-night';
      else if (hour >= 12 && hour < 17) time_bucket = 'afternoon';
      else if (hour >= 17 && hour < 24) time_bucket = 'evening';

      const context: NoteContext = {
        network_hash: simulatedNetworkHash,
        network_name: simulatedNetwork,
        time_bucket,
        is_offline: !navigator.onLine,
        device: {
          type: window.innerWidth < 900 ? 'mobile' : 'desktop',
          on_battery: batteryState.on_battery
        }
      };

      const noteToSave = {
        id: activeNoteId || undefined,
        content: debouncedContentForSave,
        context,
        is_ghost: isGhost
      };

      try {
        const savedId = await saveNote(noteToSave, cryptoKey);
        
        // Reload decrypted dataset to refresh timeline state reactively
        const refreshed = await getAllDecryptedNotes(cryptoKey);
        setNotes(refreshed);
        
        if (!activeNoteId) {
          setActiveNoteId(savedId);
        }
        setIsDirty(false);
      } catch (err) {
        console.error('Failed to auto-save:', err);
      }
    };

    performAutoSave();
  }, [debouncedContentForSave, isGhost, cryptoKey, simulatedNetwork, simulatedNetworkHash, batteryState]);

  // 9. Handle typing changes
  const handleEditorChange = (val: string) => {
    setEditorContent(val);
    setIsDirty(true);
  };

  // 10. Direct save trigger (from command palette or manual save)
  const triggerManualSave = async () => {
    if (!cryptoKey || !editorContent.trim()) return;

    const hour = new Date().getHours();
    let time_bucket: NoteContext['time_bucket'] = 'morning';
    if (hour >= 0 && hour < 5) time_bucket = 'deep-night';
    else if (hour >= 12 && hour < 17) time_bucket = 'afternoon';
    else if (hour >= 17 && hour < 24) time_bucket = 'evening';

    const context: NoteContext = {
      network_hash: simulatedNetworkHash,
      network_name: simulatedNetwork,
      time_bucket,
      is_offline: !navigator.onLine,
      device: {
        type: window.innerWidth < 900 ? 'mobile' : 'desktop',
        on_battery: batteryState.on_battery
      }
    };

    try {
      const savedId = await saveNote({
        id: activeNoteId || undefined,
        content: editorContent,
        context,
        is_ghost: isGhost
      }, cryptoKey);
      
      const refreshed = await getAllDecryptedNotes(cryptoKey);
      setNotes(refreshed);
      setActiveNoteId(savedId);
      setIsDirty(false);
    } catch (err) {
      console.error('Manual save failed:', err);
    }
  };

  // 11. Delete Note
  const handleDeleteActiveNote = async () => {
    if (!activeNoteId) {
      handleNewNote();
      return;
    }
    
    if (window.confirm('Are you sure you want to permanently erase this thought from local IndexedDB?')) {
      try {
        await deleteNote(activeNoteId);
        const refreshed = await getAllDecryptedNotes(cryptoKey!);
        setNotes(refreshed);
        handleNewNote();
      } catch (err) {
        console.error('Failed to delete note:', err);
      }
    }
  };

  // 12. Run local vector similarity updates
  useEffect(() => {
    if (!debouncedContentForSimilarity.trim() || notes.length <= 1) {
      setSimilarities([]);
      return;
    }

    // Filter out the active note to prevent matching against oneself
    const compareHistory = notes
      .filter(n => n.id !== activeNoteId)
      .map(n => ({ id: n.id, content: n.content }));

    const matches = findSimilarNotes(debouncedContentForSimilarity, compareHistory, 0.25);
    setSimilarities(matches);
  }, [debouncedContentForSimilarity, notes, activeNoteId]);

  // 13. Lock Vault & Clear memory credentials
  const handleLockVault = () => {
    localStorage.removeItem('slate_remembered_password');
    sessionStorage.removeItem('slate_explicit_locked');
    setCryptoKey(null);
    setNotes([]);
    setActiveNoteId(null);
    setEditorContent('');
    setIsGhost(false);
    setIsDirty(false);
    setIsPaletteOpen(false);
    setIsDiscoveryOpen(false);
  };

  // 14. Command executors mapped to palette
  const commandPaletteHooks = {
    clear: () => {
      handleNewNote();
    },
    copy: () => {
      if (editorContent.trim()) {
        navigator.clipboard.writeText(editorContent);
      }
    },
    export: async () => {
      try {
        const encryptedData = await exportEncryptedBackup();
        const blob = new Blob([encryptedData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `slate_encrypted_vault_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error('Export failed:', err);
      }
    },
    theme: () => {
      toggleTheme();
    },
    ghost: () => {
      setIsGhost(prev => !prev);
      setIsDirty(true);
    },
    share: () => {
      if (editorContent.trim()) {
        const shareUrl = generateShareUrl(editorContent);
        navigator.clipboard.writeText(shareUrl);
      }
    }
  };

  // 15. Import shared note into the decrypted local DB
  const handleImportSharedNote = async () => {
    if (!sharingPreview || !cryptoKey) return;
    
    const hour = new Date().getHours();
    let time_bucket: NoteContext['time_bucket'] = 'morning';
    if (hour >= 0 && hour < 5) time_bucket = 'deep-night';
    else if (hour >= 12 && hour < 17) time_bucket = 'afternoon';
    else if (hour >= 17 && hour < 24) time_bucket = 'evening';

    const context: NoteContext = {
      network_hash: simulatedNetworkHash,
      network_name: simulatedNetwork,
      time_bucket,
      is_offline: !navigator.onLine,
      device: {
        type: window.innerWidth < 900 ? 'mobile' : 'desktop',
        on_battery: batteryState.on_battery
      }
    };

    try {
      const savedId = await saveNote({
        content: sharingPreview,
        context,
        is_ghost: false
      }, cryptoKey);

      const refreshed = await getAllDecryptedNotes(cryptoKey);
      setNotes(refreshed);
      setActiveNoteId(savedId);
      setEditorContent(sharingPreview);
      setIsGhost(false);
      setIsDirty(false);
      
      // Clear URL share hash and close preview modal
      window.location.hash = '';
      setSharingPreview(null);
    } catch (err) {
      alert('Unlock your vault first to import this shared note!');
    }
  };

  return (
    <div style={styles.app}>
      {/* Visual noise/grain overlay */}
      <div className="noise-overlay" />

      {/* RENDER MODE A: Vault is Locked */}
      {!cryptoKey ? (
        <SecurityGate onUnlock={handleVaultUnlock} />
      ) : (
        /* RENDER MODE B: Vault is Unlocked */
        <div style={styles.container}>
          {/* Timeline Sidebar */}
          <Sidebar
            notes={notes}
            activeNoteId={activeNoteId}
            onSelectNote={handleSelectNote}
            onNewNote={handleNewNote}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            simulatedNetwork={simulatedNetwork}
            setSimulatedNetwork={setSimulatedNetwork}
            currentTheme={theme}
            onToggleTheme={toggleTheme}
            onLockVault={handleLockVault}
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
          />

          {/* Mobile Sidebar backdrop */}
          <div 
            className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`}
            onClick={() => setIsSidebarOpen(false)}
          />

          {/* Active Canvas Editor Area */}
          <div style={styles.editorContainer}>
            <Workspace
              activeNote={notes.find(n => n.id === activeNoteId) || null}
              editorContent={editorContent}
              setEditorContent={handleEditorChange}
              isGhost={isGhost}
              onToggleGhost={() => {
                setIsGhost(!isGhost);
                setIsDirty(true);
              }}
              simulatedNetwork={simulatedNetwork}
              isDirty={isDirty}
              onTriggerSimilarity={() => setIsDiscoveryOpen(true)}
              hasSimilarNotes={similarities.length > 0}
              onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
              onDelete={handleDeleteActiveNote}
            />
          </div>
        </div>
      )}

      {/* Stateless Link Overlay Previewer Modal */}
      {sharingPreview && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <div style={styles.modalHeaderTitle}>
                <Sparkles size={16} style={{ color: 'var(--text)', marginRight: '6px' }} />
                <h3>Zero-DB Shared Thought</h3>
              </div>
              <button 
                onClick={() => {
                  window.location.hash = '';
                  setSharingPreview(null);
                }} 
                style={styles.modalClose}
              >
                <X size={16} />
              </button>
            </div>
            
            <div style={styles.modalNotice}>
              <AlertCircle size={14} style={{ marginRight: '6px', flexShrink: 0 }} />
              <span>This text is decompressed entirely in your browser. It does not exist on any cloud server.</span>
            </div>

            <div style={styles.modalBody} className="scroll-fade-container markdown-preview">
              <pre style={styles.modalCode}>{sharingPreview}</pre>
            </div>

            <div style={styles.modalFooter}>
              {cryptoKey ? (
                <button onClick={handleImportSharedNote} style={styles.importButton}>
                  Import into Secured Vault
                </button>
              ) : (
                <div style={styles.lockedMessage}>
                  <Shield size={12} style={{ marginRight: '6px' }} />
                  Unlock your vault to import this note permanently.
                </div>
              )}
              <button 
                onClick={() => {
                  window.location.hash = '';
                  setSharingPreview(null);
                }} 
                style={styles.modalCancel}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Terminal Command Palette Modal */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        commands={commandPaletteHooks}
      />

      {/* On-device Ambient Discovery Drawer */}
      <AmbientDiscovery
        isOpen={isDiscoveryOpen}
        onClose={() => setIsDiscoveryOpen(false)}
        similarities={similarities}
        notes={notes}
        onSelectNote={handleSelectNote}
      />
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  app: {
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    backgroundColor: 'var(--bg)',
    color: 'var(--text)',
  },
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  editorContainer: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
    height: '100%',
    overflow: 'hidden',
  },
  modalBackdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    padding: '24px',
  },
  modalCard: {
    width: '100%',
    maxWidth: '640px',
    maxHeight: '85vh',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
  },
  modalHeaderTitle: {
    display: 'flex',
    alignItems: 'center',
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  modalNotice: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 20px',
    backgroundColor: 'var(--code-bg)',
    borderBottom: '1px solid var(--border)',
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  modalBody: {
    flex: '1',
    overflowY: 'auto',
    padding: '20px',
  },
  modalCode: {
    fontSize: '13px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    whiteSpace: 'pre-wrap',
    lineHeight: '1.6',
    backgroundColor: 'var(--code-bg)',
    padding: '16px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderTop: '1px solid var(--border)',
    gap: '12px',
  },
  importButton: {
    padding: '10px 16px',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  modalCancel: {
    padding: '10px 16px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    fontSize: '12px',
    cursor: 'pointer',
  },
  lockedMessage: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    fontStyle: 'italic',
  },
};
