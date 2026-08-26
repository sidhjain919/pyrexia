import io

p = 'src/routes/registrations.ts'
s = io.open(p, encoding='utf-8').read()

start = s.index("registrations.post('/registrations', async (c) => {")
end = s.index("/* ------------------------------------------------------------------ *\n * Upgrade")

new = """/**
 * Buy Basic Registration (and optionally the Delegate Card with it).
 *
 * Requires an account. The row already exists — sign-up created it with the
 * detail columns empty — so this fills them in and opens an order, rather than
 * creating a person from scratch.
 */
registrations.post('/registrations', async (c) => {
  const endpoint = 'POST /registrations'
  const body = (await readJson(c)) as Record<string, unknown>
  const key = idem.requireKey(c.req.header('Idempotency-Key'))

  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) {
    throw new ApiError('unauthorised', 'Sign in or create an account to register.')
  }

  const seen = await idem.check(c.env, { key, endpoint, body })
  if (seen.state === 'replay') {
    return c.json(seen.response.body as object, seen.response.statusCode as 200)
  }

  const { ok, errors, value } = validateRegistration({ ...body, email: session.email })
  if (!ok) {
    throw new ApiError('validation_failed', 'Some details need another look.', { fields: errors })
  }

  const requested = Array.isArray(body.products) ? (body.products as string[]) : []
  if (!requested.every((p) => typeof p === 'string')) {
    throw new ApiError('bad_request', 'products must be a list of product ids.')
  }

  // Already holds it? Then this is an upgrade, not a first purchase.
  const owned = await ownedProducts(c.env, session.registrationId)
  if (owned.has('basic')) {
    throw new ApiError(
      'already_registered',
      'Your Basic Registration is already complete. Add the Delegate Card from your pass instead.',
    )
  }

  // A phone belongs to one human. Someone else's confirmed registration
  // already holding it means a typo or a shared number, and either way it
  // should stop here rather than at the gate.
  const phoneClash = await c.env.DB.prepare(
    `SELECT public_code FROM registrations
      WHERE status = 'confirmed' AND phone = ? AND id != ? LIMIT 1`,
  )
    .bind(value.phone, session.registrationId)
    .first<{ public_code: string }>()

  if (phoneClash) {
    throw new ApiError('conflict', 'That mobile number is already on another registration.', {
      fields: { phone: 'Already registered.' },
    })
  }

  const products = await loadProducts(c.env)
  const priced = quote(requested, products, owned)
  if (!priced.ok) {
    throw new ApiError('bad_request', describeQuoteFailure(priced.failure), {
      extra: { reason: priced.failure },
    })
  }

  await idem.claim(c.env, { key, endpoint, body })

  try {
    const registrationId = session.registrationId
    const orderId = newOrderId()
    const publicCode = session.publicCode

    const rzpOrder = await createOrder(razorpayConfig(c.env), {
      amountPaise: priced.quote.totalPaise,
      receipt: orderId,
      notes: { registrationId, publicCode },
    })

    await c.env.DB.batch([
      // The account row gains its details. Email is left alone: it is the
      // login, and changing it here would let someone lock themselves out
      // in the middle of a checkout.
      c.env.DB.prepare(
        `UPDATE registrations
            SET name = ?, phone = ?, gender = ?, college = ?, city = ?, course = ?, year = ?,
                emergency_name = ?, emergency_phone = ?, updated_at = datetime('now')
          WHERE id = ?`,
      ).bind(
        value.name,
        value.phone,
        value.gender || null,
        value.college,
        value.city,
        value.course,
        value.year,
        value.emergencyName,
        value.emergencyPhone,
        registrationId,
      ),
      c.env.DB.prepare(
        `INSERT INTO orders (id, registration_id, amount_paise, razorpay_order_id, status)
         VALUES (?, ?, ?, ?, 'created')`,
      ).bind(orderId, registrationId, priced.quote.totalPaise, rzpOrder.id),
      ...priced.quote.lines.map((line) =>
        c.env.DB.prepare(
          'INSERT INTO order_items (id, order_id, product_id, amount_paise) VALUES (?, ?, ?, ?)',
        ).bind(newId(), orderId, line.productId, line.amountPaise),
      ),
    ])

    await audit.record(c.env, {
      action: 'registration.create',
      entity: 'registration',
      entityId: registrationId,
      after: { publicCode, products: requested, totalPaise: priced.quote.totalPaise },
      ip: clientIp(c),
    })

    const response = {
      registrationId,
      publicCode,
      orderId,
      checkout: {
        keyId: c.env.RAZORPAY_KEY_ID,
        razorpayOrderId: rzpOrder.id,
        amountPaise: priced.quote.totalPaise,
        currency: 'INR',
        name: value.name,
        email: session.email,
        phone: value.phone,
      },
      lines: priced.quote.lines,
    }

    await idem.remember(c.env, { key, endpoint, statusCode: 201, body: response })
    return c.json(response, 201)
  } catch (err) {
    await idem.release(c.env, { key, endpoint })
    throw err
  }
})

"""

s = s[:start] + new + s[end:]

old_upgrade = """registrations.post('/registrations/:id/upgrade', async (c) => {
  const endpoint = 'POST /registrations/:id/upgrade'
  const registrationId = c.req.param('id')
  const body = (await readJson(c)) as Record<string, unknown>
  const key = idem.requireKey(c.req.header('Idempotency-Key'))

  // Only the account holder may buy an upgrade for themselves. Without this,
  // knowing a registration id — which appears in a URL — would be enough to
  // start a payment in someone else's name.
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to add the Delegate Card.')
  if (session.registrationId !== registrationId) {
    throw new ApiError('forbidden', 'You can only upgrade your own registration.')
  }
"""
new_upgrade = """registrations.post('/registrations/:id/upgrade', async (c) => {
  const endpoint = 'POST /registrations/:id/upgrade'
  const body = (await readJson(c)) as Record<string, unknown>
  const key = idem.requireKey(c.req.header('Idempotency-Key'))

  // The session decides whose upgrade this is. The id in the path is ignored
  // entirely, so nobody can start a payment in someone else's name by editing
  // the URL.
  const session = await resolveSession(c.env, readToken(c.req.raw.headers))
  if (!session) throw new ApiError('unauthorised', 'Sign in to add the Delegate Card.')
  const registrationId = session.registrationId
"""
assert old_upgrade in s
s = s.replace(old_upgrade, new_upgrade)

# suggestEmailFix is no longer used here: the email comes from the session.
s = s.replace(
    "import { validateRegistration, suggestEmailFix } from '../lib/validate.ts'",
    "import { validateRegistration } from '../lib/validate.ts'",
)

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

# /api/me must say whether a registration is actually complete.
p = 'src/routes/me.ts'
s = io.open(p, encoding='utf-8').read()
s = s.replace(
    "    hasPass: !!pass,",
    "    // An account is not a registration. The UI leans on this to keep saying so.\n"
    "    hasRegistration: owned.has('basic'),\n"
    "    hasPass: !!pass,",
)
io.open(p, 'w', encoding='utf-8', newline='\n').write(s)

print('purchase flow now account-based')
