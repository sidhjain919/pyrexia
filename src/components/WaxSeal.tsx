import { asset } from '../lib/asset'

/**
 * The PYREXIA wax seal.
 *
 * The same stamp that is pressed into the treasure map in the hero, so the
 * Captain's Log card is signed with the fest's own mark rather than a drawn
 * approximation of one. It replaced a flat red disc with a letter on it, which
 * read as a UI element sitting next to real artwork.
 */
export default function WaxSeal({
  size = 56,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <img
      src={asset('seal.webp')}
      alt="PYREXIA wax seal"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`shrink-0 select-none ${className}`}
      style={{
        width: size,
        height: size,
        filter: 'drop-shadow(0 3px 5px rgba(36,23,16,0.45))',
      }}
    />
  )
}
