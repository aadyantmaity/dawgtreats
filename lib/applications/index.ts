import 'server-only'

import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db'
import { jobApplications } from '@/lib/db/schema'
import type { ApplicationInput } from '@/lib/validation'

export type NewApplication = ApplicationInput & {
  resumeName: string
  resumeType: string
  resume: Buffer
}

export async function saveApplication(input: NewApplication): Promise<string> {
  const [row] = await db.insert(jobApplications).values(input).returning({ id: jobApplications.id })
  return row.id
}

// The resume is the one heavy column, so a listing never selects it.
export async function listApplications() {
  return db
    .select({
      id: jobApplications.id,
      name: jobApplications.name,
      email: jobApplications.email,
      year: jobApplications.year,
      major: jobApplications.major,
      roles: jobApplications.roles,
      link: jobApplications.link,
      productAnswer: jobApplications.productAnswer,
      engineeringAnswer: jobApplications.engineeringAnswer,
      hoursPerWeek: jobApplications.hoursPerWeek,
      resumeName: jobApplications.resumeName,
      createdAt: jobApplications.createdAt,
    })
    .from(jobApplications)
    .orderBy(desc(jobApplications.createdAt))
}

export async function getResume(id: string) {
  const [row] = await db
    .select({
      name: jobApplications.name,
      resumeName: jobApplications.resumeName,
      resume: jobApplications.resume,
    })
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
  return row ?? null
}
