import type { ReactNode } from 'react'

/**
 * A very small Markdown renderer.
 *
 * It returns React elements, never an HTML string, so there is no
 * `dangerouslySetInnerHTML` anywhere near it and no possible injection: text
 * that isn't recognised as formatting is rendered as text, because that is the
 * only thing React can do with a string. This matters more than it might -
 * notices are typed by a fest committee, often pasted out of a document, and
 * "paste whatever this is into a public page" is exactly how a script tag gets
 * onto a website.
 *
 * It deliberately supports only what a notice needs: headings, lists, links,
 * bold, italic and code. Tables and images are not oversights.
 */

const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g

/** Bold, italic, code and links inside one line. */
function inline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(INLINE).filter(Boolean).map((part, i) => {
    const key = `${keyPrefix}-${i}`

    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key} className="text-offwhite">{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className="rounded bg-parchment/10 px-1.5 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      const href = link[2]
      // Only http(s) and mailto. Without this check a notice could carry a
      // `javascript:` link, which is the one way a link becomes an exploit.
      const safe = /^(https?:|mailto:|\/)/i.test(href)
      return safe ? (
        <a
          key={key}
          href={href}
          target={href.startsWith('/') ? undefined : '_blank'}
          rel="noreferrer noopener"
          className="text-gold-bright underline underline-offset-2"
        >
          {link[1]}
        </a>
      ) : (
        <span key={key}>{link[1]}</span>
      )
    }

    return <span key={key}>{part}</span>
  })
}

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')

  let paragraph: string[] = []
  let list: string[] = []

  const flushParagraph = () => {
    if (!paragraph.length) return
    const text = paragraph.join(' ')
    blocks.push(
      <p key={`p${blocks.length}`} className="text-[0.94rem] leading-relaxed text-parchment/75">
        {inline(text, `p${blocks.length}`)}
      </p>,
    )
    paragraph = []
  }

  const flushList = () => {
    if (!list.length) return
    const items = list
    blocks.push(
      <ul key={`u${blocks.length}`} className="ml-4 list-disc space-y-1.5 text-[0.94rem] text-parchment/75 marker:text-gold/60">
        {items.map((item, i) => (
          <li key={i} className="leading-relaxed">{inline(item, `u${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (!line.trim()) {
      flushParagraph()
      flushList()
      continue
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      flushParagraph()
      list.push(bullet[1])
      continue
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line)
    if (heading) {
      flushParagraph()
      flushList()
      blocks.push(
        <h3
          key={`h${blocks.length}`}
          className={
            heading[1].length === 1
              ? 'font-display text-xl text-offwhite'
              : 'font-display text-lg text-offwhite'
          }
        >
          {inline(heading[2], `h${blocks.length}`)}
        </h3>,
      )
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return <div className="space-y-3">{blocks}</div>
}
