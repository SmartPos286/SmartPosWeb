export interface EncryptedBackupEnvelope {
  app: 'SmartPOS286';
  format: 'SMARTPOS286_ENC_V1';
  alg: 'AES-GCM-256';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
  exportedAt: string;
}

const PBKDF2_ITERATIONS = 100000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltBuffer = new Uint8Array(salt).buffer;
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptBackupPayload(plainJson: string, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 4) {
    throw new Error('La contraseña de cifrado debe tener al menos 4 caracteres.');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const encoded = new TextEncoder().encode(plainJson);

  const encryptedBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
    key,
    encoded
  );

  const envelope: EncryptedBackupEnvelope = {
    app: 'SmartPOS286',
    format: 'SMARTPOS286_ENC_V1',
    alg: 'AES-GCM-256',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encryptedBuf)),
    exportedAt: new Date().toISOString(),
  };

  return JSON.stringify(envelope, null, 2);
}

export async function decryptBackupPayload(encryptedJson: string, passphrase: string): Promise<string> {
  let parsed: Partial<EncryptedBackupEnvelope>;
  try {
    parsed = JSON.parse(encryptedJson) as Partial<EncryptedBackupEnvelope>;
  } catch {
    throw new Error('El archivo no contiene JSON válido.');
  }

  if (parsed.format !== 'SMARTPOS286_ENC_V1' || !parsed.salt || !parsed.iv || !parsed.ciphertext) {
    throw new Error('El archivo no corresponde a un respaldo encriptado válido de SmartPOS286.');
  }

  const salt = fromBase64(parsed.salt);
  const iv = fromBase64(parsed.iv);
  const ciphertext = fromBase64(parsed.ciphertext);

  const key = await deriveAesKey(passphrase, salt);
  try {
    const decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv).buffer },
      key,
      new Uint8Array(ciphertext).buffer
    );
    return new TextDecoder().decode(decryptedBuf);
  } catch {
    throw new Error('Contraseña incorrecta o archivo encriptado dañado.');
  }
}
