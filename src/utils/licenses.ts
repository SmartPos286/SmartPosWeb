export interface EnabledLicenseEntry {
  id: string;
  key: string;
  planName: string;
  licenseType: 'PRO_LIFETIME' | 'STANDARD';
  description: string;
  patternHint: string;
}

export const ENABLED_SUBSCRIPTION_KEYS: EnabledLicenseEntry[] = [
  {
    id: 'master-lifetime',
    key: '23390497Mano$',
    planName: 'Licencia Maestra Vitalicia (PRO_LIFETIME)',
    licenseType: 'PRO_LIFETIME',
    description: 'Acceso total vitalicio sin límite de productos, facturas diarias ni usuarios.',
    patternHint: 'Clave maestra exacta',
  },
  {
    id: 'standard-sp286-2026',
    key: 'SP286-2026',
    planName: 'Licencia Comercial Estándar (STANDARD)',
    licenseType: 'STANDARD',
    description: 'Habilita catálogo y facturación diaria ilimitada para el comercio.',
    patternHint: 'Formato válido: SP286-XXXX (4+ caracteres alfanuméricos)',
  },
  {
    id: 'standard-sp286-pro1',
    key: 'SP286-PRO1',
    planName: 'Licencia Comercial Multicaixa (STANDARD)',
    licenseType: 'STANDARD',
    description: 'Clave comercial estándar alternativa bajo prefijo SP286-.',
    patternHint: 'Formato válido: SP286-XXXX (4+ caracteres alfanuméricos)',
  },
  {
    id: 'standard-pro-2026',
    key: 'PRO-2026',
    planName: 'Licencia Profesional Estándar (STANDARD)',
    licenseType: 'STANDARD',
    description: 'Clave comercial estándar bajo prefijo PRO-.',
    patternHint: 'Formato válido: PRO-XXXX (4+ caracteres alfanuméricos)',
  },
];

export function validateSubscriptionKey(rawKey: string): {
  valid: boolean;
  licenseType: 'PRO_LIFETIME' | 'STANDARD' | null;
  normalizedKey: string;
} {
  const key = rawKey.trim();
  if (key === '23390497Mano$') {
    return { valid: true, licenseType: 'PRO_LIFETIME', normalizedKey: key };
  }
  if (/^SP286-[A-Z0-9]{4,}$/i.test(key) || /^PRO-[A-Z0-9]{4,}$/i.test(key)) {
    return { valid: true, licenseType: 'STANDARD', normalizedKey: key.toUpperCase() };
  }
  return { valid: false, licenseType: null, normalizedKey: key };
}
