const CAJAPOS_FILENAME = 'cajapos.json';
const DRIVE_FILES_API = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime?: string;
  size?: string;
}

async function driveJsonFetch(url: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Drive HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res;
}

/**
 * Finds the hidden `cajapos.json` inside Google Drive's `appDataFolder`
 * (invisible to standard Drive browsers and accessible only to apps knowing the file/appData scope).
 */
export async function findHiddenCajaPosFile(accessToken: string): Promise<DriveFileMeta | null> {
  const q = encodeURIComponent(`name = '${CAJAPOS_FILENAME}' and trashed = false`);
  const fields = encodeURIComponent('files(id,name,modifiedTime,size)');
  const url = `${DRIVE_FILES_API}?spaces=appDataFolder&q=${q}&fields=${fields}&pageSize=5`;

  const res = await driveJsonFetch(url, accessToken);
  const data = (await res.json()) as { files?: DriveFileMeta[] };
  return data.files?.[0] ?? null;
}

export async function upsertHiddenCajaPosFile(
  accessToken: string,
  jsonContent: string
): Promise<DriveFileMeta> {
  const existing = await findHiddenCajaPosFile(accessToken);

  if (existing) {
    const res = await driveJsonFetch(`${DRIVE_UPLOAD_API}/${existing.id}?uploadType=media&fields=id,name,modifiedTime,size`, accessToken, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: jsonContent,
    });
    return (await res.json()) as DriveFileMeta;
  }

  const boundary = `smartpos286_${Date.now()}`;
  const metadata = JSON.stringify({
    name: CAJAPOS_FILENAME,
    parents: ['appDataFolder'],
    mimeType: 'application/json',
    description: 'Respaldo oculto en tiempo real de SmartPOS286',
  });

  const multipartBody = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    jsonContent,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await driveJsonFetch(`${DRIVE_UPLOAD_API}?uploadType=multipart&fields=id,name,modifiedTime,size`, accessToken, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  return (await res.json()) as DriveFileMeta;
}

export async function readHiddenCajaPosFile(accessToken: string): Promise<{ meta: DriveFileMeta; content: string } | null> {
  const existing = await findHiddenCajaPosFile(accessToken);
  if (!existing) return null;

  const res = await driveJsonFetch(`${DRIVE_FILES_API}/${existing.id}?alt=media`, accessToken);
  const content = await res.text();
  return { meta: existing, content };
}

export async function deleteHiddenCajaPosFile(accessToken: string): Promise<boolean> {
  const existing = await findHiddenCajaPosFile(accessToken);
  if (!existing) return false;
  await driveJsonFetch(`${DRIVE_FILES_API}/${existing.id}`, accessToken, {
    method: 'DELETE',
  });
  return true;
}

async function computeSha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function sealDriveBackupPayload(backupJson: string): Promise<string> {
  const parsed = JSON.parse(backupJson) as Record<string, unknown>;
  const dataCanonical = JSON.stringify(parsed.data ?? parsed);
  const integritySha256 = await computeSha256Hex(dataCanonical);
  return JSON.stringify(
    {
      ...parsed,
      integritySha256,
    },
    null,
    2
  );
}

export async function verifyAndExtractDriveBackupPayload(rawText: string): Promise<string> {
  const parsed = JSON.parse(rawText) as Record<string, unknown>;
  if (typeof parsed.integritySha256 === 'string' && parsed.integritySha256.length === 64) {
    const dataCanonical = JSON.stringify(parsed.data ?? parsed);
    const actualHash = await computeSha256Hex(dataCanonical);
    if (actualHash !== parsed.integritySha256) {
      throw new Error('El respaldo fue alterado externamente (fallo de verificación de integridad SHA-256).');
    }
  }
  return rawText;
}
