/**
 * Resolve a public asset path against Vite's base URL.
 * In dev the base is "/", in the GitHub Pages build it is "/pyrexia/", so
 * `asset('photos/p01.jpg')` yields the correct URL in both.
 */
export const asset = (path: string) => import.meta.env.BASE_URL + path.replace(/^\/+/, '')
