import React, { useState } from 'react';
import { X, Sparkles, Clock, Compass, FileText } from 'lucide-react';
import type { DecryptedNote } from '../db/database';

interface SimilarityResult {
  id: string;
  score: number;
}

interface AmbientDiscoveryProps {
  isOpen: boolean;
  onClose: () => void;
  similarities: SimilarityResult[];
  notes: DecryptedNote[];
  onSelectNote: (id: string) => void;
}

export const AmbientDiscovery: React.FC<AmbientDiscoveryProps> = ({
  isOpen,
  onClose,
  similarities,
  notes,
  onSelectNote,
}) => {
  const [previewNoteId, setPreviewNoteId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Resolve notes details from their similarity ranks
  const resolvedMatches = similarities
    .map(sim => {
      const note = notes.find(n => n.id === sim.id);
      return note ? { note, score: sim.score } : null;
    })
    .filter((match): match is { note: DecryptedNote; score: number } => match !== null);

  const activePreviewNote = notes.find(n => n.id === previewNoteId);

  // Extracted utility: get title
  const getNoteTitle = (content: string) => {
    if (!content || !content.trim()) return 'Untitled Note';
    const lines = content.trim().split('\n');
    return lines[0].replace(/^[#\s*-]+/g, '').trim() || 'Untitled Note';
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.drawer} onClick={e => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <Sparkles size={16} style={styles.sparkIcon} />
            <h2 style={styles.title}>Connected Thoughts</h2>
          </div>
          <button onClick={onClose} style={styles.closeButton} title="Close drawer">
            <X size={16} />
          </button>
        </div>

        {resolvedMatches.length === 0 ? (
          <div style={styles.emptyContainer}>
            <Compass size={36} style={styles.emptyIcon} />
            <p style={styles.emptyText}>No deep semantic connections detected yet.</p>
            <p style={styles.emptySub}>
              Type more technical keywords or elaborate on your thoughts in the canvas to trigger local-first clustering.
            </p>
          </div>
        ) : (
          <div style={styles.contentArea}>
            {/* Left side or main list */}
            <div style={styles.matchList} className="scroll-fade-container">
              <p style={styles.deckSub}>
                On-device cosine similarity matched {resolvedMatches.length} historical logs in your vault:
              </p>
              
              {resolvedMatches.map(({ note, score }) => {
                const isSelected = note.id === previewNoteId;
                const scorePercent = Math.round(score * 100);
                
                return (
                  <div
                    key={note.id}
                    onClick={() => setPreviewNoteId(note.id === previewNoteId ? null : note.id)}
                    style={isSelected ? styles.cardActive : styles.card}
                  >
                    <div style={styles.cardHeader}>
                      <span style={styles.matchPercent}>
                        {scorePercent}% match
                      </span>
                      <span style={styles.cardTime}>
                        <Clock size={10} style={{ marginRight: '3px' }} />
                        {new Date(note.updated_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <h3 style={styles.cardTitle}>{getNoteTitle(note.content)}</h3>
                    <p style={styles.cardSnippet}>
                      {note.content.split('\n').slice(1).join(' ').replace(/[*_`#]/g, '').substring(0, 70)}...
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Ghost Preview Overlay Panel (if a match is selected) */}
            {activePreviewNote && (
              <div style={styles.previewPanel}>
                <div style={styles.previewHeader}>
                  <span style={styles.ghostBadge}>
                    <FileText size={10} style={{ marginRight: '4px' }} />
                    <span>Ghost Preview</span>
                  </span>
                  <div style={styles.previewHeaderActions}>
                    <button
                      onClick={() => {
                        onSelectNote(activePreviewNote.id);
                        onClose();
                      }}
                      style={styles.openButton}
                      title="Load this note directly to the active editor"
                    >
                      Open Note
                    </button>
                    <button
                      onClick={() => setPreviewNoteId(null)}
                      style={styles.closePreviewButton}
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>

                <div style={styles.previewBody} className="scroll-fade-container">
                  <h1 style={styles.previewTitle}>{getNoteTitle(activePreviewNote.content)}</h1>
                  <pre style={styles.previewText}>{activePreviewNote.content}</pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 900,
    animation: 'fadeIn 0.2s ease-out',
  },
  drawer: {
    width: '100%',
    maxWidth: '560px',
    height: '100%',
    backgroundColor: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    boxShadow: 'var(--shadow)',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  sparkIcon: {
    color: 'var(--text)',
    animation: 'pulseGlow 2.5s infinite',
    borderRadius: '50%',
  },
  title: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: '1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px',
    textAlign: 'center',
  },
  emptyIcon: {
    color: 'var(--text-muted)',
    opacity: 0.4,
    marginBottom: '16px',
  },
  emptyText: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '8px',
  },
  emptySub: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: '1.5',
    maxWidth: '300px',
  },
  contentArea: {
    display: 'flex',
    flex: '1',
    overflow: 'hidden',
    position: 'relative',
  },
  matchList: {
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  deckSub: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
    marginBottom: '8px',
  },
  card: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardActive: {
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid var(--text)',
    backgroundColor: 'var(--accent-soft)',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  matchPercent: {
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    color: 'var(--text)',
    backgroundColor: 'var(--accent-soft)',
    padding: '2px 6px',
    borderRadius: '10px',
    border: '1px solid var(--border)',
  },
  cardTime: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '10px',
    color: 'var(--text-muted)',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  cardSnippet: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
  },
  previewPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.05)',
    animation: 'fadeIn 0.2s ease-out',
  },
  previewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--code-bg)',
  },
  ghostBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '10px',
    fontWeight: 500,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
  },
  previewHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  openButton: {
    padding: '4px 10px',
    backgroundColor: 'var(--text)',
    color: 'var(--bg)',
    border: 'none',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
  },
  closePreviewButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  previewBody: {
    flex: '1',
    overflowY: 'auto',
    padding: '24px 20px',
  },
  previewTitle: {
    fontSize: '18px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '16px',
    fontFamily: 'var(--font-serif)',
  },
  previewText: {
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
};
export default AmbientDiscovery;
