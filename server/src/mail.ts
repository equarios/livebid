/** Local-first mail: logs to console; uses Resend when RESEND_API_KEY is set. */

export type MailMessage = {
  to: string
  subject: string
  text: string
}

export async function sendMail(msg: MailMessage): Promise<{ ok: boolean; via: string }> {
  const key = process.env.RESEND_API_KEY?.trim()
  const from = process.env.MAIL_FROM?.trim() || 'Equarios <onboarding@resend.dev>'

  if (!key) {
    console.log(
      [
        '',
        '── Equarios mail (console) ──',
        `To: ${msg.to}`,
        `Subject: ${msg.subject}`,
        msg.text,
        '────────────────────────────',
        '',
      ].join('\n'),
    )
    return { ok: true, via: 'console' }
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject,
        text: msg.text,
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('Resend failed', res.status, body)
      return { ok: false, via: 'resend' }
    }
    return { ok: true, via: 'resend' }
  } catch (err) {
    console.error('Resend error', err)
    return { ok: false, via: 'resend' }
  }
}
