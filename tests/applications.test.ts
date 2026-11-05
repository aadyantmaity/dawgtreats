import { beforeEach, describe, expect, it } from 'vitest'

import { getResume, listApplications, saveApplication } from '@/lib/applications'
import { applicationSchema, withScheme } from '@/lib/validation'

import { resetDatabase } from './helpers'

beforeEach(resetDatabase)

const application = {
  name: 'Sam Rivera',
  email: 'sam@uw.edu',
  year: 'freshman' as const,
  major: 'Informatics',
  roles: ['engineering' as const],
  link: 'https://github.com/sam',
  productAnswer: null,
  engineeringAnswer: 'A seating chart the whole floor used.',
  hoursPerWeek: 10,
}

describe('applying', () => {
  it('keeps the answers and the resume together', async () => {
    const id = await saveApplication({
      ...application,
      resumeName: 'sam.pdf',
      resumeType: 'application/pdf',
      resume: Buffer.from('%PDF-1.4'),
    })

    const [saved] = await listApplications()
    expect(saved).toMatchObject({ name: 'Sam Rivera', roles: ['engineering'], hoursPerWeek: 10 })
    expect((await getResume(id))?.resume.toString()).toBe('%PDF-1.4')
  })

  it('asks for a role', () => {
    const parsed = applicationSchema.safeParse({ ...application, roles: [] })
    expect(parsed.success).toBe(false)
  })

  // Each role asks its own question, so the other one stays empty without failing.
  it('wants the question its role asks', () => {
    const missing = applicationSchema.safeParse({ ...application, engineeringAnswer: null })
    expect(missing.success).toBe(false)

    const other = applicationSchema.safeParse({
      ...application,
      roles: ['product'],
      productAnswer: 'A standing order for the same three cookies every week.',
      engineeringAnswer: null,
    })
    expect(other.success).toBe(true)
  })

  it('takes a link pasted without a scheme', () => {
    expect(withScheme('github.com/sam')).toBe('https://github.com/sam')
    expect(withScheme('https://github.com/sam')).toBe('https://github.com/sam')
  })
})
