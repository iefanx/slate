import Dexie, { type Table } from 'dexie';
import { encryptText, decryptText } from '../services/crypto';

// Note Context Types
export interface NoteContext {
  network_hash: string;
  network_name: string;
  time_bucket: 'morning' | 'afternoon' | 'evening' | 'deep-night';
  is_offline: boolean;
  device: {
    type: 'desktop' | 'mobile';
    on_battery: boolean;
  };
}

// Encrypted Database Record Structure
export interface NoteRecord {
  id: string;
  content_encrypted: string;
  iv: string; // Content IV
  salt: string; // Database Salt (inherited or custom)
  created_at: number;
  updated_at: number;
  context_encrypted: string;
  context_iv: string; // Context IV
  is_ghost: boolean;
}

// Decrypted note runtime structure
export interface DecryptedNote {
  id: string;
  content: string;
  created_at: number;
  updated_at: number;
  context: NoteContext;
  is_ghost: boolean;
}

// Initialize Dexie DB
class SlateDatabase extends Dexie {
  notes!: Table<NoteRecord>;

  constructor() {
    super('SlateDatabase');
    this.version(1).stores({
      notes: 'id, created_at, updated_at, is_ghost'
    });
  }
}

export const db = new SlateDatabase();

// DATABASE TRANSACTIONS WITH ON-THE-FLY CRYPTO

// 1. Encrypt and save (insert or update) a note
export async function saveNote(
  note: {
    id?: string;
    content: string;
    context: NoteContext;
    is_ghost: boolean;
    created_at?: number;
  },
  key: CryptoKey
): Promise<string> {
  const id = note.id || crypto.randomUUID();
  const now = Date.now();
  const created_at = note.created_at || now;
  
  // Encrypt content
  const contentCrypto = await encryptText(note.content, key);
  
  // Encrypt context object
  const contextJson = JSON.stringify(note.context);
  const contextCrypto = await encryptText(contextJson, key);
  
  const record: NoteRecord = {
    id,
    content_encrypted: contentCrypto.ciphertext,
    iv: contentCrypto.iv,
    salt: '', // Reserved for record-level salt if needed
    created_at,
    updated_at: now,
    context_encrypted: contextCrypto.ciphertext,
    context_iv: contextCrypto.iv,
    is_ghost: note.is_ghost
  };
  
  await db.notes.put(record);
  return id;
}

// 2. Fetch and decrypt all notes in the database
export async function getAllDecryptedNotes(key: CryptoKey): Promise<DecryptedNote[]> {
  const records = await db.notes.orderBy('updated_at').reverse().toArray();
  const decryptedNotes: DecryptedNote[] = [];
  
  for (const record of records) {
    try {
      // Decrypt content
      const content = await decryptText(record.content_encrypted, record.iv, key);
      
      // Decrypt context
      const contextJson = await decryptText(record.context_encrypted, record.context_iv, key);
      const context: NoteContext = JSON.parse(contextJson);
      
      decryptedNotes.push({
        id: record.id,
        content,
        created_at: record.created_at,
        updated_at: record.updated_at,
        context,
        is_ghost: record.is_ghost
      });
    } catch (err) {
      console.error(`Failed to decrypt note record ${record.id}:`, err);
      // Skip or report corrupted note (e.g. if encrypted under a different password)
    }
  }
  
  return decryptedNotes;
}

// 3. Delete a note
export async function deleteNote(id: string): Promise<void> {
  await db.notes.delete(id);
}

// 4. Batch export encrypted notes (for backups or debugging)
export async function exportEncryptedBackup(): Promise<string> {
  const records = await db.notes.toArray();
  return JSON.stringify(records, null, 2);
}

// 5. Batch import notes
export async function importNotesFromBackup(records: NoteRecord[]): Promise<void> {
  await db.transaction('rw', db.notes, async () => {
    for (const record of records) {
      await db.notes.put(record);
    }
  });
}
