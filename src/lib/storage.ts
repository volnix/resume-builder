import { emptyResume, type Resume } from '../types'
import { normalizeResume } from './normalize'

const KEY = 'resume-builder:v1'

export function loadResume(): Resume {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyResume()
    // Normalizing on read is what lets older saves — flat v1 positions, saves
    // written before themes existed — keep loading without a migration step.
    return normalizeResume(JSON.parse(raw))
  } catch {
    return emptyResume()
  }
}

export function saveResume(resume: Resume): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(resume))
  } catch {
    // Quota exceeded or storage disabled (private browsing) — editing still works.
    // A large headshot is the likeliest cause, and it stays in memory regardless.
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* nothing to do */
  }
}
