import { formatMonthYear, utcDay } from './dates';

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  issueDate: Date;
  expiryDate?: Date;
  credentialId?: string;
  verifyUrl?: string;
  hidden?: boolean;
}

export type Validity =
  | { kind: 'none' }
  | { kind: 'valid'; until: Date }
  | { kind: 'expired'; on: Date };

/** Expired only when the expiry day is strictly before today's UTC day. */
export function isExpired(c: Certification, today: Date): boolean {
  if (!c.expiryDate) return false;
  return utcDay(c.expiryDate) < utcDay(today);
}

export function validity(c: Certification, today: Date): Validity {
  if (!c.expiryDate) return { kind: 'none' };
  return isExpired(c, today)
    ? { kind: 'expired', on: c.expiryDate }
    : { kind: 'valid', until: c.expiryDate };
}

export function validityLabel(v: Validity): string | null {
  if (v.kind === 'valid') return `Valid until ${formatMonthYear(v.until)}`;
  if (v.kind === 'expired') return `Expired ${formatMonthYear(v.on)}`;
  return null;
}

/** Hidden removed; newest issue date first; ties by name A to Z. */
export function visibleCertifications(list: Certification[]): Certification[] {
  return list
    .filter((c) => !c.hidden)
    .sort((a, b) => {
      const byDate = utcDay(b.issueDate) - utcDay(a.issueDate);
      return byDate !== 0 ? byDate : a.name.localeCompare(b.name, 'en');
    });
}

export function hasVerification(c: Certification): boolean {
  return typeof c.verifyUrl === 'string' && c.verifyUrl.length > 0;
}

export function showTickNote(list: Certification[]): boolean {
  return visibleCertifications(list).some(hasVerification);
}
