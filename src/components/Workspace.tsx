import React, { useState, useEffect } from 'react';
import { Eye, Edit2, Share2, Shield, ShieldOff, Sparkles, Menu, Trash2, Wifi, Check, Columns } from 'lucide-react';
import type { DecryptedNote } from '../db/database';
import { generateShareUrl } from '../services/compressor';

interface WorkspaceProps {
  activeNote: DecryptedNote | null;
  editorContent: string;
  setEditorContent: (val: string) => void;
  isGhost: boolean;
  onToggleGhost: () => void;
  simulatedNetwork: string;
  isDirty: boolean;
  onTriggerSimilarity: () => void;
  hasSimilarNotes: boolean;
  onToggleSidebar: () => void;
  onDelete: () => void;
}

// Built-in high-speed regex-based Markdown to HTML parser
function parseMarkdown(md: string): string {
  if (!md) return '<p style="color: var(--text-muted); font-style: italic;">Start typing to see your words...</p>';
  
  // Protect HTML entities
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // Code Blocks (```code```)
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => `<pre><code>${code.trim()}</code></pre>`);
  
  // Headers (# H1, ## H2, ### H3)
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  
  // Bold (**bold**)
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Italics (*italic*)
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  
  // Inline Code (`code`)
  html = html.replace(/`(.*?)`/g, '<code>$1</code>');
  
  // Blockquotes (> quote)
  html = html.replace(/^&gt; (.*$)/gim, '<blockquote>$1</blockquote>');
  
  // Lists (- list or * list)
  html = html.replace(/^[-*] (.*$)/gim, '<li>$1</li>');
  
  // Restructure and wrap lists properly
  const lines = html.split('\n');
  let output = '';
  let inList = false;
  
  for (let line of lines) {
    if (line.startsWith('<li>')) {
      if (!inList) {
        output += '<ul>';
        inList = true;
      }
      output += line;
    } else {
      if (inList) {
        output += '</ul>';
        inList = false;
      }
      // Treat standard text lines as paragraphs if not block tags
      const trimmed = line.trim();
      if (
        trimmed && 
        !trimmed.startsWith('<h') && 
        !trimmed.startsWith('<pre') && 
        !trimmed.startsWith('</pre') && 
        !trimmed.startsWith('<code') && 
        !trimmed.startsWith('</code') && 
        !trimmed.startsWith('<blockquote>') && 
        !trimmed.startsWith('</blockquote>') &&
        !trimmed.startsWith('<ul>') &&
        !trimmed.startsWith('</ul>')
      ) {
        output += `<p>${line}</p>`;
      } else {
        output += line + '\n';
      }
    }
  }
  
  if (inList) output += '</ul>';
  return output;
}

export const Workspace: React.FC<WorkspaceProps> = ({
  activeNote,
  editorContent,
  setEditorContent,
  isGhost,
  onToggleGhost,
  simulatedNetwork,
  isDirty,
  onTriggerSimilarity,
  hasSimilarNotes,
  onToggleSidebar,
  onDelete,
}) => {
  const [viewMode, setViewMode] = useState<'write' | 'preview' | 'split'>(
    window.innerWidth < 900 ? 'write' : 'split'
  );
  const [shareCopied, setShareCopied] = useState<boolean>(false);

  // Sync editor mode with screen size on load
  useEffect(() => {
    let wasMobile = window.innerWidth < 900;
    
    const handleResize = () => {
      const isMobileNow = window.innerWidth < 900;
      if (isMobileNow !== wasMobile) {
        setViewMode(isMobileNow ? 'write' : 'split');
        wasMobile = isMobileNow;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleShare = () => {
    if (!editorContent.trim()) return;
    
    const shareUrl = generateShareUrl(editorContent);
    navigator.clipboard.writeText(shareUrl).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    });
  };

  const getWordCount = (): number => {
    if (!editorContent.trim()) return 0;
    return editorContent.trim().split(/\s+/).length;
  };

  const getCharCount = (): number => {
    return editorContent.length;
  };

  return (
    <div style={styles.workspace}>
      {/* Editor Header Panel */}
      <header style={styles.header}>
        <div style={styles.titleArea}>
          <button
            onClick={onToggleSidebar}
            style={styles.menuToggleButton}
            title="Toggle sidebar [Cmd+\]"
            className="workspace-sidebar-toggle"
          >
            <Menu size={15} />
          </button>
          
          <div style={styles.logoContainer}>
            <span style={styles.logoText}>Slate</span>
            <span style={isDirty ? styles.modifiedDot : styles.savedDot} />
          </div>

          <span style={styles.noteStatus} className="desktop-only">
            {activeNote ? 'Vault Document' : 'Scratchpad Draft'}
            {isDirty && <span style={styles.dirtyLabel}> *modified</span>}
          </span>
        </div>

        <div style={styles.controlBar} className="control-bar">
          {/* Ambient vector cluster glow indicator */}
          {hasSimilarNotes && (
            <button
              onClick={onTriggerSimilarity}
              style={{ ...styles.glowButton, animation: 'pulseGlow 2s infinite' }}
              title="Conceptual connection discovered! Click to reveal matches."
            >
              <Sparkles size={14} style={{ marginRight: '6px' }} />
              <span className="btn-label">Connected Mind</span>
            </button>
          )}

          {/* Erase Thought (only visible when a note is loaded) */}
          {activeNote && (
            <button
              onClick={onDelete}
              style={styles.deleteButton}
              title="Wipe this thought permanently from IndexedDB"
            >
              <Trash2 size={13} style={{ marginRight: '4px' }} />
              <span className="btn-label">Erase</span>
            </button>
          )}

          {/* Ghost Mode Status */}
          <button
            onClick={onToggleGhost}
            style={isGhost ? styles.ghostActiveButton : styles.ghostButton}
            title={
              isGhost
                ? `Ghost note pinned to network: ${simulatedNetwork || 'Offline State'}`
                : 'Convert to network-bound Ghost note'
            }
          >
            {isGhost ? (
              <>
                <Shield size={14} style={{ marginRight: '4px' }} />
                <span className="btn-label">Ghost: {simulatedNetwork || 'Offline'}</span>
              </>
            ) : (
              <>
                <ShieldOff size={14} style={{ marginRight: '4px' }} />
                <span className="btn-label">Standard</span>
              </>
            )}
          </button>

          {/* Share note button */}
          <button
            onClick={handleShare}
            style={shareCopied ? styles.shareActiveButton : styles.shareButton}
            title="Generate stateless Zero-DB URL hash"
            disabled={!editorContent.trim()}
            className={shareCopied ? "share-active-btn" : ""}
          >
            {shareCopied ? (
              <Check size={14} style={{ marginRight: '4px' }} className="share-active-icon" />
            ) : (
              <Share2 size={14} style={{ marginRight: '4px' }} />
            )}
            <span className="btn-label">{shareCopied ? 'Copied!' : 'Share'}</span>
          </button>

          {/* Editor view controls */}
          <div style={styles.segmentedControl} className="desktop-only">
            <button
              onClick={() => setViewMode('write')}
              style={viewMode === 'write' ? styles.segActive : styles.segButton}
              title="Write mode"
            >
              <Edit2 size={12} style={{ marginRight: '4px' }} className="seg-control-icon" />
              <span className="btn-label">Write</span>
            </button>
            <button
              onClick={() => setViewMode('preview')}
              style={viewMode === 'preview' ? styles.segActive : styles.segButton}
              title="Preview mode"
            >
              <Eye size={12} style={{ marginRight: '4px' }} className="seg-control-icon" />
              <span className="btn-label">Preview</span>
            </button>
            <button
              onClick={() => setViewMode('split')}
              style={viewMode === 'split' ? styles.segActive : styles.segButton}
              className="desktop-only"
              title="Split view"
            >
              <Columns size={12} style={{ marginRight: '4px' }} className="seg-control-icon" />
              <span className="btn-label">Split</span>
            </button>
          </div>

          {/* Mobile-only view toggle button */}
          <button
            onClick={() => setViewMode(viewMode === 'preview' ? 'write' : 'preview')}
            className="mobile-only"
            style={styles.shareButton}
            title={viewMode === 'preview' ? "Switch to Edit" : "Switch to Preview"}
          >
            {viewMode === 'preview' ? <Edit2 size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </header>

      {/* Main Text Area and Rendering Panels */}
      <div style={styles.editorArea}>
        {(viewMode === 'write' || viewMode === 'split') && (
          <textarea
            value={editorContent}
            onChange={e => setEditorContent(e.target.value)}
            placeholder="# Write your thought here...&#10;&#10;Supports bold, italics, blockquotes, lists, inline code, and ```code blocks```.&#10;&#10;Press Cmd+/ or Ctrl+/ to trigger commands."
            className="editor-textarea"
            style={{
              ...styles.textarea,
              width: viewMode === 'split' ? '50%' : '100%',
              borderRight: viewMode === 'split' ? '1px solid var(--border)' : 'none',
            }}
            autoFocus
          />
        )}
        
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div
            style={{
              ...styles.previewPanel,
              width: viewMode === 'split' ? '50%' : '100%',
            }}
            className="scroll-fade-container markdown-preview editor-preview"
            dangerouslySetInnerHTML={{ __html: parseMarkdown(editorContent) }}
          />
        )}
      </div>

      {/* Editor Footer Metrics */}
      <footer style={styles.footer} className="workspace-footer">
        <div style={styles.footerSection}>
          <Wifi size={12} style={{ marginRight: '4px', opacity: 0.8 }} />
          <span style={styles.footerLabel} className="desktop-only">environment:</span>
          <span style={styles.footerVal}>{simulatedNetwork || 'Offline Sandbox'}</span>
        </div>
        <div style={styles.footerSection}>
          <span className="desktop-only">
            <span style={styles.footerVal}>{getWordCount()}</span> words
            <span style={styles.footerSeparator}>|</span>
            <span style={styles.footerVal}>{getCharCount()}</span> characters
          </span>
          <span className="mobile-only">
            <span style={styles.footerVal}>{getWordCount()}</span>w
            <span style={styles.footerSeparator}>|</span>
            <span style={styles.footerVal}>{getCharCount()}</span>c
          </span>
        </div>
        <div style={styles.footerSection} className="desktop-only">
          <kbd>Cmd</kbd> + <kbd>/</kbd> to command
        </div>
      </footer>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  workspace: {
    display: 'flex',
    flexDirection: 'column',
    flex: '1',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--bg)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    borderBottom: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: '12px',
  },
  titleArea: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  menuToggleButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '4px',
    marginRight: '4px',
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginRight: '12px',
  },
  logoText: {
    fontFamily: 'var(--font-serif)',
    fontSize: '18px',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--text)',
  },
  savedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#10b981', // green
  },
  modifiedDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#f59e0b', // orange
    animation: 'pulseGlow 1.5s infinite',
  },
  noteStatus: {
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
  },
  dirtyLabel: {
    fontStyle: 'italic',
    fontSize: '11px',
    opacity: 0.8,
  },
  controlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  glowButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 12px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--bg)',
    backgroundColor: 'var(--text)',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
  },
  deleteButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  ghostButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: '12px',
    fontFamily: 'var(--font-sans)',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  ghostActiveButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: '12px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    backgroundColor: 'var(--accent-soft)',
    color: 'var(--text)',
    border: '1px solid var(--text)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  shareButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  shareActiveButton: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    fontSize: '12px',
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    color: '#10b981',
    border: '1px solid #10b981',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  segmentedControl: {
    display: 'flex',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  segButton: {
    padding: '6px 10px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontFamily: 'var(--font-sans)',
  },
  segActive: {
    padding: '6px 10px',
    backgroundColor: 'var(--accent-soft)',
    border: 'none',
    color: 'var(--text)',
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    fontSize: '11px',
    fontFamily: 'var(--font-sans)',
  },
  editorArea: {
    display: 'flex',
    flex: '1',
    overflow: 'hidden',
  },
  textarea: {
    height: '100%',
    fontSize: '16px',
    fontFamily: 'var(--font-mono)',
    backgroundColor: 'transparent',
    color: 'var(--text)',
    border: 'none',
    resize: 'none',
    outline: 'none',
    lineHeight: '1.6',
  },
  previewPanel: {
    height: '100%',
    overflowY: 'auto',
    backgroundColor: 'transparent',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 24px',
    borderTop: '1px solid var(--border)',
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontFamily: 'var(--font-mono)',
  },
  footerSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  footerLabel: {
    opacity: 0.6,
  },
  footerVal: {
    fontWeight: 600,
    color: 'var(--text)',
  },
  footerSeparator: {
    margin: '0 8px',
    opacity: 0.3,
  },
};
export default Workspace;
