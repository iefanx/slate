import React, { useState, useEffect, useRef } from 'react';
import { Terminal, CornerDownLeft } from 'lucide-react';

interface CommandItem {
  command: string;
  description: string;
  shortcut: string;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands: {
    clear: () => void;
    copy: () => void;
    export: () => void;
    theme: () => void;
    ghost: () => void;
    share: () => void;
  };
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, commands }) => {
  const [search, setSearch] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // List of all active command palette entries
  const commandList: CommandItem[] = [
    {
      command: '/clear',
      description: 'Archive current canvas and start a blank scratchpad',
      shortcut: '⌘ + ⌫',
      action: () => {
        commands.clear();
        onClose();
      },
    },
    {
      command: '/copy',
      description: 'Copy active editor contents to clipboard as clean markdown',
      shortcut: '⌘ + C',
      action: () => {
        commands.copy();
        onClose();
      },
    },
    {
      command: '/export',
      description: 'Download complete history as a JSON backup',
      shortcut: '⌘ + E',
      action: () => {
        commands.export();
        onClose();
      },
    },
    {
      command: '/theme',
      description: 'Swap aesthetics (Vintage Off-White ↔ OLED Dark)',
      shortcut: '⌘ + T',
      action: () => {
        commands.theme();
        onClose();
      },
    },
    {
      command: '/ghost',
      description: 'Toggle network-bound ephemerality for this note',
      shortcut: '⌘ + G',
      action: () => {
        commands.ghost();
        onClose();
      },
    },
    {
      command: '/share',
      description: 'Generate stateless base64 shareable URL hash',
      shortcut: '⌘ + S',
      action: () => {
        commands.share();
        onClose();
      },
    },
    {
      command: '/close',
      description: 'Close terminal command palette',
      shortcut: 'ESC',
      action: () => {
        onClose();
      },
    },
  ];

  // Filter commands by active query
  const filteredCommands = commandList.filter(
    item =>
      item.command.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  );

  // Handle focus and global keydown for palette open/close
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      // Let the modal animate in slightly before focusing
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle navigation inside palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Ensure active element is scrolled into view inside the list
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        const listHeight = listRef.current.clientHeight;
        const activeTop = activeEl.offsetTop;
        const activeHeight = activeEl.clientHeight;
        
        if (activeTop + activeHeight > listRef.current.scrollTop + listHeight) {
          listRef.current.scrollTop = activeTop + activeHeight - listHeight;
        } else if (activeTop < listRef.current.scrollTop) {
          listRef.current.scrollTop = activeTop;
        }
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.palette} onClick={e => e.stopPropagation()}>
        {/* Terminal Header */}
        <div style={styles.header}>
          <Terminal size={14} style={{ marginRight: '8px', color: 'var(--text-muted)' }} />
          <span style={styles.headerTitle}>Slate Command Palette</span>
        </div>

        {/* Input Bar */}
        <div style={styles.inputWrapper}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search actions..."
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              setSelectedIndex(0);
            }}
            style={styles.input}
          />
        </div>

        {/* Commands List */}
        <div ref={listRef} style={styles.list}>
          {filteredCommands.length === 0 ? (
            <div style={styles.emptyState}>No commands match your query.</div>
          ) : (
            filteredCommands.map((item, index) => {
              const isActive = index === selectedIndex;
              return (
                <div
                  key={item.command}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={isActive ? styles.itemActive : styles.item}
                >
                  <div style={styles.itemMain}>
                    <span style={isActive ? styles.cmdTextActive : styles.cmdText}>{item.command}</span>
                    <span style={styles.descText}>{item.description}</span>
                  </div>
                  <div style={styles.itemMeta}>
                    {isActive ? (
                      <span style={styles.enterBadge}>
                        <CornerDownLeft size={10} style={{ marginRight: '3px' }} />
                        <span>enter</span>
                      </span>
                    ) : (
                      <kbd style={styles.shortcut}>{item.shortcut}</kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Navigation Hints */}
        <div style={styles.footer}>
          <span>Use ↑↓ keys to navigate</span>
          <span>•</span>
          <span>↵ to execute</span>
          <span>•</span>
          <span>esc to close</span>
        </div>
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
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingTop: '15vh',
    zIndex: 1000,
    animation: 'fadeIn 0.2s ease-out',
  },
  palette: {
    width: '100%',
    maxWidth: '560px',
    backgroundColor: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--code-bg)',
  },
  headerTitle: {
    fontSize: '11px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputWrapper: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border)',
  },
  input: {
    width: '100%',
    border: 'none',
    background: 'none',
    fontSize: '15px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    outline: 'none',
  },
  list: {
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '6px 0',
  },
  emptyState: {
    padding: '16px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  itemActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    cursor: 'pointer',
    backgroundColor: 'var(--accent-soft)',
  },
  itemMain: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    flex: '1',
    minWidth: 0, // Enable text clipping
  },
  cmdText: {
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    flexShrink: 0,
  },
  cmdTextActive: {
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text)',
    flexShrink: 0,
  },
  descText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemMeta: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '12px',
  },
  shortcut: {
    fontSize: '9px',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  enterBadge: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '10px 16px',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--code-bg)',
    fontSize: '10px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-muted)',
    opacity: 0.8,
  },
};
export default CommandPalette;
