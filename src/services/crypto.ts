// Cryptographic Service using Browser Web Crypto API (AES-GCM-256 + PBKDF2)

// Helper: Convert ArrayBuffer to Base64 String
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper: Convert Base64 String to Uint8Array
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper: Convert String to ArrayBuffer
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Derive a CryptoKey from a plain password and a salt using PBKDF2
export async function deriveKey(password: string, salt: any): Promise<CryptoKey> {
  const passwordBuffer = encoder.encode(password);
  
  // Import raw password bytes as a key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive AES-GCM-256 key from the key material
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // Key is non-extractable for security
    ['encrypt', 'decrypt']
  );
}

// Encrypt plain text using derived key and randomly generated IV
export async function encryptText(
  text: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 12-byte IV for AES-GCM
  const encodedText = encoder.encode(text);
  
  const ciphertextBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as any
    },
    key,
    encodedText
  );
  
  return {
    ciphertext: arrayBufferToBase64(ciphertextBuffer),
    iv: arrayBufferToBase64(iv.buffer)
  };
}

// Decrypt ciphertext using derived key and IV
export async function decryptText(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const ciphertextBytes = base64ToUint8Array(ciphertext);
  const ivBytes = base64ToUint8Array(iv);
  
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes as any
    },
    key,
    ciphertextBytes as any
  );
  
  return decoder.decode(decryptedBuffer);
}

// Initialize secure local system
// Returns { saltBase64, sentinelCiphertext, sentinelIv } for a new password
export async function setupVault(password: string): Promise<{
  salt: string;
  sentinel: string;
  sentinelIv: string;
}> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16)); // 16-byte salt
  const saltBase64 = arrayBufferToBase64(saltBytes.buffer);
  
  const key = await deriveKey(password, saltBytes as any);
  const { ciphertext, iv } = await encryptText('slate-sentinel-v1', key);
  
  return {
    salt: saltBase64,
    sentinel: ciphertext,
    sentinelIv: iv
  };
}


// Verify if the entered password matches the stored credentials
export async function verifyVaultPassword(
  password: string,
  saltBase64: string,
  sentinelCipher: string,
  sentinelIv: string
): Promise<CryptoKey | null> {
  try {
    const saltBytes = base64ToUint8Array(saltBase64);
    const key = await deriveKey(password, saltBytes);
    
    // Attempt decryption of verification sentinel
    const decrypted = await decryptText(sentinelCipher, sentinelIv, key);
    if (decrypted === 'slate-sentinel-v1') {
      return key;
    }
    return null;
  } catch (error) {
    console.error('Password verification decryption failed:', error);
    return null;
  }
}

// Helper: Calculate SHA-256 hash of a string (useful for environment Network SSID hashes)
export async function hashString(text: string): Promise<string> {
  const msgBuffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
