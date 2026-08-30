import { Link, useLocation } from 'react-router-dom'
import { SITE } from '../data/site'
import { BASIC_AMOUNT, DELEGATE_ADDON } from '../data/registration'

/**
 * The four pages Razorpay checks for before activating live payments: terms,
 * privacy, refunds and contact.
 *
 * They share one component because they share one shape, a title, a date, and
 * prose in a readable column. Four near-identical files would drift apart the
 * first time someone edited one of them.
 *
 * Written to be read rather than to be legally impressive. A student who wants
 * to know whether they can get their money back should find that out in one
 * sentence, not four paragraphs of hedging.
 */

const UPDATED = '30 August 2026'
const ORG = 'the PYREXIA Organising Committee, All India Institute of Medical Sciences, Rishikesh'
const EMAIL = 'pyrexia@aiimsrishikesh.edu.in'
/**
 * Rupees in, rupees out. This used to divide by a hundred, on the assumption
 * that it was handed paise: `BASIC_AMOUNT` is 500 rupees, so the refund page
 * had been promising nobody could get their four rupees fifty back.
 */
const rupees = (amount: number) => `₹${amount.toLocaleString('en-IN')}`

export default function Legal() {
  const { pathname } = useLocation()

  const page =
    pathname.includes('privacy') ? privacy()
    : pathname.includes('refund') || pathname.includes('cancel') ? refunds()
    : pathname.includes('contact') ? contact()
    : terms()

  return (
    <section className="relative px-6 py-24 sm:py-28">
      <div className="mx-auto max-w-2xl">
        <div className="font-log text-[0.62rem] uppercase tracking-cinema text-gold/70">
          {SITE.name} {SITE.year} · {SITE.dates}
        </div>
        <h1 className="mt-3 font-display text-3xl leading-tight text-offwhite sm:text-4xl">
          {page.title}
        </h1>
        <p className="mt-2 font-log text-[0.62rem] uppercase tracking-wide2 text-parchment/45">
          Last updated {UPDATED}
        </p>

        <div className="mt-10 space-y-7">{page.body}</div>

        <nav className="mt-16 flex flex-wrap gap-x-5 gap-y-2 border-t border-gold/12 pt-7 font-log text-[0.62rem] uppercase tracking-wide2">
          {[
            ['/terms', 'Terms'],
            ['/privacy', 'Privacy'],
            ['/refunds', 'Refunds'],
            ['/contact', 'Contact'],
            ['/', 'Back to the island'],
          ].map(([to, label]) => (
            <Link
              key={to}
              to={to}
              className={
                pathname === to
                  ? 'text-gold-bright'
                  : 'text-parchment/45 transition-colors hover:text-gold-bright'
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Shared bits
 * ------------------------------------------------------------------ */

const H = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display text-xl text-offwhite">{children}</h2>
)

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[0.95rem] leading-relaxed text-parchment/72">{children}</p>
)

const L = ({ children }: { children: React.ReactNode }) => (
  <ul className="ml-5 list-disc space-y-2 text-[0.95rem] leading-relaxed text-parchment/72 marker:text-gold/50">
    {children}
  </ul>
)

const Block = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-3">{children}</div>
)

/* ------------------------------------------------------------------ *
 * Terms
 * ------------------------------------------------------------------ */

function terms() {
  return {
    title: 'Terms & Conditions',
    body: (
      <>
        <Block>
          <P>
            {SITE.name} {SITE.year} is the annual socio-cultural and sports festival of{' '}
            {SITE.institutionFull}, organised by {ORG}. It runs from {SITE.dates} on the AIIMS
            Rishikesh campus. By registering you agree to what follows.
          </P>
        </Block>

        <Block>
          <H>What you are buying</H>
          <P>
            <strong className="text-parchment">Basic Registration ({rupees(BASIC_AMOUNT)})</strong> is
            compulsory for everyone attending. It admits you to the festival for all five days and
            allows you to enter and compete in any event.
          </P>
          <P>
            <strong className="text-parchment">The Festival Pass (a further {rupees(DELEGATE_ADDON)})</strong>{' '}
            can be bought with your Basic Registration or added later at the same price. It is the
            only way to attend the Pro Nights. Basic Registration alone does not admit you to them.
          </P>
          <P>
            <strong className="text-parchment">Individual event entry fees.</strong> Some events
            charge their own entry fee on top of Basic Registration. The amount is shown on that
            event's entry form and is paid on this website; nothing is collected at the venue.
          </P>
          <P>
            <strong className="text-parchment">Payment gateway charges.</strong> Our payment
            provider's charge of 2.36% (2% plus GST) is added to every amount above and shown as its
            own line before you pay. The figures quoted on this site are exclusive of it.
          </P>
        </Block>

        <Block>
          <H>Your pass</H>
          <L>
            <li>Your pass is personal to you and is not transferable.</li>
            <li>
              Entry is one scan per gate per day. If someone else uses your pass first, you will be
              refused entry.
            </li>
            <li>
              You must carry photo identification and your institutional or college ID alongside your
              pass.
            </li>
            <li>
              We may cancel a pass without refund if it is shared, forged, or obtained by giving
              false information.
            </li>
          </L>
        </Block>

        <Block>
          <H>Conduct</H>
          <P>
            You are on the premises of a medical institution and a hospital campus. Ragging,
            harassment, intoxication, damage to property and any behaviour endangering others will
            result in removal from the festival without refund, and may be reported to the
            institute and to the police.
          </P>
          <P>
            The decisions of event judges, coordinators and the organising committee are final.
          </P>
        </Block>

        <Block>
          <H>Things that may change</H>
          <P>
            Event schedules, venues, judges and performing artists may change. Pro Night line-ups
            are announced closer to the festival and are subject to artist availability. A change of
            line-up, schedule or venue is not grounds for a refund.
          </P>
          <P>
            If the festival is cancelled in its entirety by the organisers, we will announce how
            registrations will be handled at that time.
          </P>
        </Block>

        <Block>
          <H>Liability</H>
          <P>
            You take part at your own risk, particularly in sporting events. The organisers and the
            institute are not liable for personal injury, or for loss of or damage to belongings.
            You are responsible for your own travel, accommodation and insurance unless we have
            explicitly provided them.
          </P>
        </Block>

        <Block>
          <H>Photography</H>
          <P>
            The festival is photographed and filmed. By attending you consent to appearing in
            images and video used to promote {SITE.name} and AIIMS Rishikesh. Write to us at{' '}
            <a href={`mailto:${EMAIL}`}>{EMAIL}</a> if you would like an image of yourself removed
            and we will do what we reasonably can.
          </P>
        </Block>

        <Block>
          <H>Law</H>
          <P>
            These terms are governed by the laws of India. Disputes fall under the jurisdiction of
            the courts at Dehradun, Uttarakhand.
          </P>
        </Block>
      </>
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Privacy
 * ------------------------------------------------------------------ */

function privacy() {
  return {
    title: 'Privacy Policy',
    body: (
      <>
        <Block>
          <P>
            {ORG} collects and holds your information for the purpose of running {SITE.name}{' '}
            {SITE.year}. This page says what we hold, why, and for how long.
          </P>
        </Block>

        <Block>
          <H>What we collect</H>
          <L>
            <li>
              <strong className="text-parchment">Your account.</strong> Email address and a
              password, which we store only as a cryptographic hash and can never read.
            </li>
            <li>
              <strong className="text-parchment">Your registration.</strong> Name, mobile number,
              gender, college, city, course, year of study, and an emergency contact.
            </li>
            <li>
              <strong className="text-parchment">Identity documents.</strong> Where you upload
              them for verification at the gate.
            </li>
            <li>
              <strong className="text-parchment">Payments.</strong> The amount, the method and the
              reference number. <strong className="text-parchment">We never see or store your card
              or UPI details</strong>; those go directly to Razorpay.
            </li>
            <li>
              <strong className="text-parchment">Attendance.</strong> When your pass is scanned,
              and at which gate.
            </li>
          </L>
        </Block>

        <Block>
          <H>Why we collect it</H>
          <P>
            To issue and verify your pass, to run the events you enter, to contact you about the
            festival, to reach someone if you are unwell or injured on campus, and to keep proper
            financial records.
          </P>
          <P>
            We do not sell your information. We do not share it with sponsors. We do not send you
            marketing for anything other than {SITE.name}.
          </P>
        </Block>

        <Block>
          <H>Who else touches it</H>
          <L>
            <li><strong className="text-parchment">Razorpay</strong>, to take payment.</li>
            <li><strong className="text-parchment">Our email provider</strong>, to deliver your pass and confirmations.</li>
            <li><strong className="text-parchment">Cloudflare</strong>, where the website and database are hosted.</li>
          </L>
        </Block>

        <Block>
          <H>How long we keep it</H>
          <P>
            <strong className="text-parchment">Identity documents are deleted within 30 days of the
            festival ending.</strong> Registration and payment records are kept for as long as
            required for accounting and audit, and then deleted.
          </P>
        </Block>

        <Block>
          <H>Keeping it safe</H>
          <P>
            Everything travels over an encrypted connection. Identity documents are encrypted at
            rest, are never publicly reachable, and can be opened only by a named verifier, and every
            such viewing is logged. Passwords are hashed. Your pass is cryptographically signed so
            it cannot be forged.
          </P>
        </Block>

        <Block>
          <H>Your rights</H>
          <P>
            Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> to see what we hold about you, correct
            it, or ask us to delete it. We will respond within 30 days. Deleting your data before
            the festival will cancel your registration, and refunds are not available.
          </P>
        </Block>
      </>
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Refunds
 * ------------------------------------------------------------------ */

function refunds() {
  return {
    title: 'Refund & Cancellation Policy',
    body: (
      <>
        <Block>
          <div className="rounded-xl border border-coral/40 bg-coral/10 p-5">
            <p className="font-display text-lg text-offwhite">
              Registration fees are non-refundable.
            </p>
            <p className="mt-2 text-[0.92rem] leading-relaxed text-parchment/75">
              Once your payment is confirmed, none of Basic Registration ({rupees(BASIC_AMOUNT)}),
              the Festival Pass ({rupees(DELEGATE_ADDON)}) or an individual event entry fee can be
              refunded or transferred to another person. Payment gateway charges are not refundable
              in any circumstance, as they are not ours to return.
            </p>
          </div>
        </Block>

        <Block>
          <H>Why</H>
          <P>
            {SITE.name} is run by students on a fixed budget. Venues, artists, equipment and
            materials are committed well before the festival on the strength of registrations
            received, and that money cannot be recovered afterwards.
          </P>
        </Block>

        <Block>
          <H>This applies even if</H>
          <L>
            <li>You are unable to attend, for any reason.</li>
            <li>You attend only some of the five days.</li>
            <li>You withdraw from an event you had entered, or paid an entry fee for.</li>
            <li>An event, venue or artist line-up changes.</li>
            <li>Your registration is cancelled for breaking the terms.</li>
          </L>
        </Block>

        <Block>
          <H>The one exception</H>
          <P>
            If you are <strong className="text-parchment">charged twice for the same
            registration</strong> (a duplicate payment for one person), write to us and we will
            refund the duplicate in full. Send your registration number and the payment reference
            to <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
          </P>
          <P>
            Approved refunds are returned to the original payment method within 7 working days.
            Your bank may take a few days more to show it.
          </P>
        </Block>

        <Block>
          <H>Payments that fail</H>
          <P>
            If a payment fails but your bank shows the money as deducted, it has not reached us.
            Banks reverse these automatically, usually within 5 to 7 working days. Nothing is owed
            to you by us, and you can simply try again. If it has not reversed after a week, write
            to us with the reference and we will help you trace it.
          </P>
        </Block>

        <Block>
          <H>If we cancel the festival</H>
          <P>
            If {SITE.name} {SITE.year} is called off entirely by the organisers, we will announce
            how registrations will be handled and contact everyone who has registered.
          </P>
        </Block>
      </>
    ),
  }
}

/* ------------------------------------------------------------------ *
 * Contact
 * ------------------------------------------------------------------ */

function contact() {
  return {
    title: 'Contact Us',
    body: (
      <>
        <Block>
          <P>
            {SITE.name} {SITE.year} is organised by {ORG}. The quickest way to reach the crew is by
            email, and we aim to reply within two working days.
          </P>
        </Block>

        <Block>
          <div className="glass rounded-xl p-6">
            <div className="font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">Email</div>
            <a
              href={`mailto:${EMAIL}`}
              className="mt-1 block break-all font-display text-lg text-gold-bright"
            >
              {EMAIL}
            </a>

            <div className="mt-6 font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
              Address
            </div>
            <address className="mt-1 not-italic text-[0.95rem] leading-relaxed text-parchment/72">
              {ORG}
              <br />
              Virbhadra Marg, Shivaji Nagar
              <br />
              Rishikesh, Uttarakhand 249203
              <br />
              India
            </address>

            <div className="mt-6 font-log text-[0.6rem] uppercase tracking-cinema text-gold/70">
              Festival dates
            </div>
            <div className="mt-1 text-[0.95rem] text-parchment/72">
              {SITE.dates} · {SITE.theme}
            </div>
          </div>
        </Block>

        <Block>
          <H>What to tell us</H>
          <P>
            If your question is about a registration or a payment, include your{' '}
            <strong className="text-parchment">registration number</strong>. It looks like{' '}
            <span className="font-log text-gold-bright">PYX26-XXXXXX</span> and is on your pass and
            in your confirmation email. It lets us find you immediately.
          </P>
        </Block>

        <Block>
          <H>Common questions</H>
          <L>
            <li>
              <strong className="text-parchment">Haven't received your pass?</strong> Check your
              spam folder first, then sign in and open <Link to="/pass">My Pass</Link>. It's always
              there.
            </li>
            <li>
              <strong className="text-parchment">Can't sign in?</strong> Use "Forgot your password"
              on the <Link to="/sign-in">sign-in page</Link>.
            </li>
            <li>
              <strong className="text-parchment">Registered with the wrong email?</strong> Write to
              us with your name and mobile number and we will correct it.
            </li>
          </L>
        </Block>
      </>
    ),
  }
}
