> **Superseded in part.** Registration and payment now run against the real API
> in `src/api/client.ts` — see `api/README.md`. The mock adapter below is still
> used by `EventForm`, which stays behind the `EVENT_REGISTRATION_OPEN` flag
> until event entries open. The pass itself now lives at `src/pages/Pass.tsx`.

# Registration

Two separate journeys, deliberately not merged:

| | Delegate registration | Event entry |
|---|---|---|
| opened by | `openDelegate()` / `openRegister()` with no argument | `openRegister(eventName)` |
| entry points | navbar, hero, CTA, footer, island panel | every per-event **Register** button |
| collects | personal details, Aadhaar + student ID, pass tier, payment | event-specific answers, team roster |
| produces | a paid pass — `PYX26-XXXXXX` + QR | an entry — `ENT-XXXXXXXX` |

**An event entry is impossible without a confirmed pass.** `EventForm` gates on
`api.findDelegate` and refuses anything whose status isn't `confirmed`; the mock
`registerForEvent` re-checks server-side rather than trusting the screen. Team-mates must
each supply their own pass number too.

## Files

| file | role |
|---|---|
| `api.ts` | **the swap point** — `RegistrationApi` interface + a localStorage mock |
| `types.ts` | wire types shared by the forms and the adapter |
| `razorpay.ts` | checkout launcher; simulates a capture when no key is configured |
| `DelegateForm.tsx` | 3-step pass purchase |
| `EventForm.tsx` | pass gate → event-specific entry |
| `fields.tsx` | inputs, chip group, document uploader |
| `context.tsx` | which flow is open, and for which event |
| `../data/registration.ts` | pass catalogue + per-event form shapes |

## Going live

### 1. Replace the adapter

Write an object satisfying `RegistrationApi` and change the last line of `api.ts`:

```ts
export const api: RegistrationApi = supabaseApi   // was: mockApi
```

Nothing else changes. Also set `IS_MOCK_BACKEND = false` so the UI stops saying records
are browser-only.

### 2. What the server must do — not optional

- **Decide the amount itself.** Never let the client name a price. Look the tier up from
  `passId` server-side.
- **Create the Razorpay order with the secret key** and return only the `order_id`.
- **Verify `razorpay_signature`** — `HMAC_SHA256(order_id + "|" + payment_id, key_secret)`
  — before flipping a pass to `confirmed`. The browser's success callback is not proof of
  payment; treat it as a hint.
- **Store Aadhaar and student ID in a private bucket**, admin-read only, reachable solely
  through short-lived signed URLs. Never public objects, never a predictable path. Set a
  deletion job for after the fest — the consent checkbox promises exactly that.
- **Sign the QR payload.** The current mock payload is plain text, so anyone can mint one.
  Issue a signed token (JWT or HMAC) the gate scanner verifies offline.
- **Enforce uniqueness in the database**, not just in the form: one confirmed pass per
  email/phone, one entry per delegate per event.
- **Rate-limit `findDelegate`.** It's an email/phone lookup that confirms whether a person
  registered; without a limit it enumerates your attendee list.

### 3. Payments

Set `VITE_RAZORPAY_KEY_ID` in the environment. Until it exists, `paymentsAreLive` is
false, checkout is simulated, and the UI says so. Only the **key id** belongs in the
frontend — the key secret must never reach the bundle.

### 4. Fees

`BASIC_AMOUNT` (₹450) and `DELEGATE_ADDON` (₹2250) in `../data/registration.ts` are the
single source of truth; `DELEGATE_PASSES` derives both tiers and their line-item
breakdown from them, and the whole site reads those constants. The mock backend also
prices from `DELEGATE_PASSES` — a real backend must price server-side and never trust the
`passId` amount the client sends.

### 5. Event entries

`EVENT_REGISTRATION_OPEN` is `false`, so every per-event form renders a "Coming Soon"
panel that routes visitors to Basic Registration instead. Flip it to `true` when entries
open; nothing else needs to change.

## Adding or changing an event's form

Everything lives in `../data/registration.ts`:

- `territoryDefaults` — the shape every event in a vertical gets.
- `eventOverrides` — only events that genuinely differ from their vertical.
- `F` — the reusable field definitions.

Setting `teamSize: undefined` in an override means "explicitly solo", and beats the
territory default. Adding an event to `data/events.ts` needs no work here — it inherits
its territory's default.
