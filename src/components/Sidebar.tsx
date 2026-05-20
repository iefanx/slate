import React from 'react';
import { Plus, Search, Sun, Moon, Lock, Wifi, Shield } from 'lucide-react';
import type { DecryptedNote } from '../db/database';

interface SidebarProps {
  notes: DecryptedNote[];
  activeNoteId: string | null;
  onSelectNote: (id: string | null) => void;
  onNewNote: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  simulatedNetwork: string;
  setSimulatedNetwork: (net: string) => void;
  currentTheme: 'vintage' | 'oled';
  onToggleTheme: () => void;
  onLockVault: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

// Map time bucket labels to friendly display strings
const BUCKET_DISPLAY: { [key: string]: { label: string; icon: string } } = {
  'deep-night': { label: 'Deep Night', icon: '🌑' },
  'morning': { label: 'Morning Thoughts', icon: '🌅' },
  'afternoon': { label: 'Afternoon Log', icon: '☀️' },
  'evening': { label: 'Evening Scribbles', icon: '🌇' },
};

// Extracted utility: get title from raw markdown content
function getNoteTitle(content: string): string {
  if (!content || !content.trim()) return 'Untitled Note';
  
  const lines = content.trim().split('\n');
  const firstLine = lines[0].replace(/^[#\s*-]+/g, '').trim();
  
  if (firstLine.length > 28) {
    return firstLine.substring(0, 26) + '...';
  }
  return firstLine || 'Untitled Note';
}

// Extracted utility: get snippet of content for preview
function getNoteSnippet(content: string): string {
  if (!content) return '';
  const lines = content.trim().split('\n');
  // Skip the first line if it was the title
  const bodyLines = lines.slice(1).filter(l => l.trim().length > 0);
  const bodyText = bodyLines.join(' ').replace(/[*_`#]/g, '');
  
  if (bodyText.length > 50) {
    return bodyText.substring(0, 48) + '...';
  }
  return bodyText || 'Empty canvas...';
}

export const SlateLogoSmall: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ ...style, display: 'inline-block', verticalAlign: 'middle' }}>
    {/* Background slate plate */}
    <rect x="8" y="14" width="32" height="32" rx="4" transform="rotate(-10 8 14)" fill="var(--text)" fillOpacity="0.15" stroke="var(--text)" strokeWidth="1.5" />
    {/* Foreground slate plate */}
    <rect x="16" y="10" width="32" height="32" rx="4" transform="rotate(-3 16 10)" fill="var(--text)" stroke="var(--text)" strokeWidth="1.5" />
    {/* The "S" character inside the foreground slate in beautiful Georgia/serif style */}
    <text x="32" y="30" fill="var(--bg)" fontSize="18" fontFamily="var(--font-serif)" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" transform="rotate(-3 32 30)">S</text>
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({
  notes,
  activeNoteId,
  onSelectNote,
  onNewNote,
  searchQuery,
  setSearchQuery,
  simulatedNetwork,
  setSimulatedNetwork,
  currentTheme,
  onToggleTheme,
  onLockVault,
  isOpen = false,
}) => {
  
  // Filter notes:
  // 1. Search filter (matches content or SSID names)
  // 2. Network-Bound Ephemerality Filter:
  //    - If note.is_ghost is true, it is ONLY visible if note.context.network_hash matches current simulated network hash!
  //    - Non-ghost notes are visible everywhere regardless of active network.
  const filteredNotes = notes.filter(note => {
    // 1. Ghost filtering
    if (note.is_ghost && note.context.network_name !== simulatedNetwork) {
      return false;
    }
    
    // 2. Search filtering
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      note.content.toLowerCase().includes(q) ||
      note.context.network_name.toLowerCase().includes(q)
    );
  });

  // Group notes into time buckets
  const groupedBuckets: { [key: string]: DecryptedNote[] } = {
    'morning': [],
    'afternoon': [],
    'evening': [],
    'deep-night': [],
  };

  filteredNotes.forEach(note => {
    const bucket = note.context.time_bucket || 'morning';
    if (groupedBuckets[bucket]) {
      groupedBuckets[bucket].push(note);
    } else {
      groupedBuckets['morning'].push(note);
    }
  });

  const availableNetworks = ['Home Wi-Fi', 'Office HQ', 'Coffee Shop', 'Offline Sandbox'];

  return (
    <aside className={`sidebar-panel ${isOpen ? 'open' : 'collapsed'}`}>
      {/* Sidebar Header Title & New Action */}
      <div style={styles.header}>
        <div style={styles.logoArea}>
          <SlateLogoSmall size={20} />
          <span style={styles.logoText}>Slate</span>
          <span style={styles.versionBadge}>v1.0</span>
        </div>
        <button onClick={onNewNote} style={styles.newButton} title="Create Scratchpad [Cmd+N]">
          <Plus size={16} />
        </button>
      </div>

      {/* SSID Network Simulator Dropdown in Sidebar */}
      <div style={styles.networkSwitcher}>
        <Wifi size={13} style={styles.wifiIcon} />
        <select
          value={simulatedNetwork}
          onChange={e => setSimulatedNetwork(e.target.value)}
          style={styles.select}
          title="Switch simulated local SSID environment"
        >
          {availableNetworks.map(net => (
            <option key={net} value={net}>
              {net}
            </option>
          ))}
        </select>
      </div>

      {/* Local search input */}
      <div style={styles.searchContainer}>
        <Search size={14} style={styles.searchIcon} />
        <input
          type="text"
          placeholder="Search thoughts..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Grouped Timeline Scrollport */}
      <div style={styles.timelineArea} className="scroll-fade-container">
        {filteredNotes.length === 0 ? (
          <div style={styles.emptyState}>
            {searchQuery ? 'No matching thoughts.' : 'Timeline is blank.'}
          </div>
        ) : (
          Object.keys(groupedBuckets).map(bucketKey => {
            const bucketNotes = groupedBuckets[bucketKey];
            if (bucketNotes.length === 0) return null;

            return (
              <div key={bucketKey} style={styles.bucketGroup}>
                <div style={styles.bucketHeader}>
                  <span style={styles.bucketIcon}>{BUCKET_DISPLAY[bucketKey].icon}</span>
                  <span style={styles.bucketTitle}>{BUCKET_DISPLAY[bucketKey].label}</span>
                  <span style={styles.bucketCount}>({bucketNotes.length})</span>
                </div>
                
                <div style={styles.noteList}>
                  {bucketNotes.map(note => {
                    const isActive = note.id === activeNoteId;
                    return (
                      <div
                        key={note.id}
                        onClick={() => onSelectNote(note.id)}
                        style={isActive ? styles.noteCardActive : styles.noteCard}
                        className="note-card-timeline"
                      >
                        <div style={styles.cardHeader}>
                          <span style={styles.cardTitle}>{getNoteTitle(note.content)}</span>
                          {note.is_ghost && (
                            <span style={styles.ghostIcon} title="SSID Network-bound Ghost Note">
                              <Shield size={10} />
                            </span>
                          )}
                        </div>
                        <div style={styles.cardSnippet}>{getNoteSnippet(note.content)}</div>
                        <div style={styles.cardFooter}>
                          <span>{new Date(note.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          {note.is_ghost && <span style={styles.cardNetwork}>{note.context.network_name}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sidebar Footer control deck */}
      <footer style={styles.footer}>
        <div style={styles.footerLeft}>
          <button type="button" onClick={onToggleTheme} style={styles.footerButton} title="Toggle aesthetic theme">
            {currentTheme === 'vintage' ? (
              <>
                <Moon size={13} style={{ marginRight: '6px' }} />
                <span>OLED Mode</span>
              </>
            ) : (
              <>
                <Sun size={13} style={{ marginRight: '6px' }} />
                <span>Paper Mode</span>
              </>
            )}
          </button>

        </div>

        <button type="button" onClick={onLockVault} style={styles.lockButton} title="Lock vault & scrub memory">
          <Lock size={13} style={{ marginRight: '6px' }} />
          <span>Lock</span>
        </button>
      </footer>
    </aside>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 20px 10px',
  },
  logoArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoText: {
    fontSize: '20px',
    fontWeight: 700,
    fontFamily: 'var(--font-serif)',
    letterSpacing: '-0.03em',
    color: 'var(--text)',
  },
  versionBadge: {
    fontSize: '9px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '0 4px',
  },
  newButton: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px',
    cursor: 'pointer',
    color: 'var(--text)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkSwitcher: {
    display: 'flex',
    alignItems: 'center',
    margin: '8px 20px 12px',
    padding: '6px 12px',
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    gap: '8px',
  },
  wifiIcon: {
    color: 'var(--text-muted)',
  },
  select: {
    flex: '1',
    border: 'none',
    background: 'none',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    outline: 'none',
    cursor: 'pointer',
  },
  searchContainer: {
    position: 'relative',
    margin: '0 20px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    color: 'var(--text-muted)',
    pointerEvents: 'none',
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 30px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    outline: 'none',
  },
  timelineArea: {
    flex: '1',
    overflowY: 'auto',
    padding: '0 20px 20px',
  },
  emptyState: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    marginTop: '40px',
    fontStyle: 'italic',
  },
  bucketGroup: {
    marginBottom: '24px',
  },
  bucketHeader: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '10px',
    gap: '6px',
  },
  bucketIcon: {
    fontSize: '11px',
  },
  bucketTitle: {
    fontWeight: 600,
  },
  bucketCount: {
    opacity: 0.6,
  },
  noteList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  noteCard: {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  noteCardActive: {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--text)',
    backgroundColor: 'var(--accent-soft)',
    cursor: 'pointer',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  cardTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  ghostIcon: {
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
  },
  cardSnippet: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    marginBottom: '8px',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    opacity: 0.8,
  },
  cardNetwork: {
    border: '1px solid var(--border)',
    borderRadius: '3px',
    padding: '0 4px',
    fontSize: '8px',
    textTransform: 'uppercase',
  },
  footer: {
    padding: '12px 20px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg)',
  },
  footerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-start',
  },
  footerButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '11px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  lockButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444', // Red lock button for warnings
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};
export default Sidebar;
