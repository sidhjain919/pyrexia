> **Superseded in part.** Registration and payment now run against the real API
> in `src/api/client.ts`, see `api/README.md`. The mock adapter below is still
> used by `EventForm`, which is gated per territory by the server (see
> **Event entries** below). The pass itself now lives at `src/pages/Pass.tsx`.

# Registration

Two separate journeys, deliberately not merged:

| | Delegate registration | Event entry |
|---|---|---|
| opened by | `openDelegate()` / `openRegister()` with no argument | `openRegister(eventName)` |
| entry points | navbar, hero, CTA, footer, island panel | every per-event **Register** button |
| collects | personal details, Aadhaar + student ID, pass tier, payment | event-specific answers, team roster |
| produces | a paid pass: `PYX26-XXXXXX` + QR | an entry, `ENT-XXXXXXXX` |

**An event entry is impossible without a confirmed pass.** `EventForm` gates on
`api.findDelegate` and refuses anything whose status isn't `confirmed`; the mock
`registerForEvent` re-checks server-side rather than trusting the screen. Team-mates must
each supply their own pass number too.

## Files

| file | role |
|---|---|
| `api.ts` | **the swap point**, `RegistrationApi` interface + a localStorage mock |
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

### 2. What the server must do, not optional

- **Decide the amount itself.** Never let the client name a price. Look the tier up from
  `passId` server-side.
- **Create the Razorpay order with the secret key** and return only the `order_id`.
- **Verify `razorpay_signature`**: `HMAC_SHA256(order_id + "|" + payment_id, key_secret)`
 , before flipping a pass to `confirmed`. The browser's success callback is not proof of
  payment; treat it as a hint.
- **Store Aadhaar and student ID in a private bucket**, admin-read only, reachable solely
  through short-lived signed URLs. Never public objects, never a predictable path. Set a
  deletion job for after the fest: the consent checkbox promises exactly that.
- **Sign the QR payload.** The current mock payload is plain text, so anyone can mint one.
  Issue a signed token (JWT or HMAC) the gate scanner verifies offline.
- **Enforce uniqueness in the database**, not just in the form: one confirmed pass per
  email/phone, one entry per delegate per event.
- **Rate-limit `findDelegate`.** It's an email/phone lookup that confirms whether a person
  registered; without a limit it enumerates your attendee list.

### 3. Payments

Set `VITE_RAZORPAY_KEY_ID` in the environment. Until it exists, `paymentsAreLive` is
false, checkout is simulated, and the UI says so. Only the **key id** belongs in the
frontend: the key secret must never reach the bundle.

### 4. Fees

`BASIC_AMOUNT` (₹450) and `DELEGATE_ADDON` (₹2250) in `../data/registration.ts` are the
single source of truth; `DELEGATE_PASSES` derives both tiers and their line-item
breakdown from them, and the whole site reads those constants. The mock backend also
prices from `DELEGATE_PASSES`: a real backend must price server-side and never trust the
`passId` amount the client sends.

### 5. Event entries

Which territories accept entries lives in the `event_openings` table, one row per
vertical, flipped from the Registration switches panel on `/admin`. Under each vertical
every event has a switch of its own in `event_switches` (no row = open), for closing one
full bracket without touching its neighbours. An event is open only when both say so:
`data/openings.ts` reads them and `POST /api/me/events` checks `isEventOpen` on every
entry. The grid asks
`GET /api/events/openings` once per page load via `useOpenings`, falling back to
`DEFAULT_OPEN_TERRITORIES` in `src/data/registration.ts` while that request is in
flight: a label, never a decision. Anything closed renders a "Coming Soon" panel with
the rulebook still attached.

**Teams enter once.** Whoever fills the form lists their crew (`members`, name and
optional phone) and pays for everyone; there is no invitation, no token and no account
for a team-mate to hold. `head_count` is the crew plus the entrant, snapshotted on the
entry because three dance events price a group per head, and the server takes that
count from the squad it stored, never from a number the client claims.

**One entry per band, not per event.** Badminton singles and doubles are two
competitions, so the unique index is `(registration_id, event_name, fee_variant)`. The
entry form greys out bands you already hold.

**External forms.** Every Thunderbolt bracket, and the Battle of Bands screening round,
sets `form` on its `SubEvent` (with `formTitle`/`formNote` saying what the form is for):
the site links out to the crew's Google Form and `POST /api/me/events` refuses the event
outright, so nobody ends up believing they entered twice.

**Refunds.** A refund made on the Razorpay dashboard reaches `lib/refunds.ts` two ways:
the `refund.created`/`refund.processed` webhooks, and the fifteen-minute sweep that lists
Razorpay's refunds, and the `refunds` table is keyed by Razorpay's id so both paths write
it once. An order is undone (entitlements revoked, pass revoked if nothing is left,
registration cancelled) only when what has come back reaches the fest's share; a partial
refund is recorded on `orders.refunded_paise` and audited, and revokes nothing.

**Paid entries.** An event with a fee in `api/src/data/fees.ts` cannot be settled in one
request, because the money arrives by webhook. The entry is written `pending` with a
Razorpay order attached, the form opens checkout, and the webhook flips it to
`confirmed`. A cancelled payment leaves a pending row that the next attempt stands down,
so retrying is safe. The unique index only covers `confirmed`, so an abandoned checkout
never locks anyone out.

## Adding or changing an event's form

Everything lives in `../data/registration.ts`:

- `territoryDefaults`: the shape every event in a vertical gets.
- `eventOverrides`: only events that genuinely differ from their vertical.
- `F`: the reusable field definitions.

Setting `teamSize: undefined` in an override means "explicitly solo", and beats the
territory default. Adding an event to `data/events.ts` needs no work here, it inherits
its territory's default.

`api/src/data/events.ts` is a **generated copy** of the form half of this file, same
definitions, different import line. Change this file, then regenerate that one, or the
server will validate against a form the site is no longer showing.

Two other files travel with an event:

- `../data/fees.ts` (display) and `api/src/data/fees.ts` (paise, the authority). A band
  marked `perHead` is multiplied by the crew size at checkout.
- `../data/rulebooks.ts`: the four or five lines from the rulebook that change whether
  somebody enters, plus that event's coordinators. The full PDF is per vertical, on
  `Territory.rulebook`.
