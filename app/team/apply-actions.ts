'use server'

import { headers } from 'next/headers'

import { saveApplication } from '@/lib/applications'
import { alertApplication, sendApplicationReceived } from '@/lib/email'
import { callerIp, checkLimit } from '@/lib/limits'
import { MESSAGES, LIMITS, RESUME_TYPES, applicationSchema, withScheme } from '@/lib/validation'

export type ApplyResult = { ok: true } | { ok: false; error: string }

function text(form: FormData, field: string): string {
  const value = form.get(field)
  return typeof value === 'string' ? value.trim() : ''
}

export async function submitApplication(form: FormData): Promise<ApplyResult> {
  try {
    // Server actions get no Request object, so the address comes from the incoming headers.
    const ip = callerIp(new Request('http://localhost', { headers: await headers() }))
    const { ok } = await checkLimit('application', ip)
    if (!ok) return { ok: false, error: 'That is plenty for now. Try again later.' }

    const roles = form.getAll('roles').filter((role): role is string => typeof role === 'string')
    const parsed = applicationSchema.safeParse({
      name: text(form, 'name'),
      email: text(form, 'email'),
      year: text(form, 'year'),
      major: text(form, 'major'),
      roles,
      link: withScheme(text(form, 'link')),
      productAnswer: roles.includes('product') ? text(form, 'productAnswer') : null,
      engineeringAnswer: roles.includes('engineering') ? text(form, 'engineeringAnswer') : null,
      hoursPerWeek: Number(text(form, 'hoursPerWeek')),
    })
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message }

    // The browser enforces neither the size nor the type, so both are checked here.
    const file = form.get('resume')
    if (!(file instanceof File) || file.size === 0) {
      return { ok: false, error: MESSAGES.resumeRequired }
    }
    if (file.size > LIMITS.resumeMaxBytes) return { ok: false, error: MESSAGES.resumeTooBig }
    if (!RESUME_TYPES.includes(file.type as (typeof RESUME_TYPES)[number])) {
      return { ok: false, error: MESSAGES.resumeType }
    }

    await saveApplication({
      ...parsed.data,
      resumeName: file.name,
      resumeType: file.type,
      resume: Buffer.from(await file.arrayBuffer()),
    })

    // The application is saved, so neither message can fail the submission.
    await Promise.all([
      sendApplicationReceived(parsed.data.email, parsed.data.name, parsed.data.roles),
      alertApplication({ ...parsed.data, roles: parsed.data.roles }),
    ])

    return { ok: true }
  } catch (error) {
    console.error('application_failed', { error })
    return { ok: false, error: 'Something went wrong. Try again.' }
  }
}
