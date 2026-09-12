/**
 * The Google side of the event sheets: a small Apps Script web app.
 *
 * The sheets belong to a real Google account, and the script that made them
 * runs as that account, so it can write into them without any Google Cloud key
 * at all (the fest's Cloud project forbids service-account keys by policy).
 * The script is published as a web app anyone can reach, and refuses every
 * request that does not carry the shared secret.
 *
 * Two actions:
 *   list   every event sheet in the folder, as { event, id }
 *   write  replace the first tab of one sheet with a grid of rows
 */

export type ScriptConfig = { url: string; secret: string }

export function scriptConfig(env: { SHEETS_SCRIPT_URL?: string; SHEETS_SCRIPT_SECRET?: string }): ScriptConfig | null {
  if (!env.SHEETS_SCRIPT_URL || !env.SHEETS_SCRIPT_SECRET) return null
  return { url: env.SHEETS_SCRIPT_URL, secret: env.SHEETS_SCRIPT_SECRET }
}

/** The script said no, or could not be reached. `retryable` for outages and lock timeouts. */
export class SheetsScriptError extends Error {
  readonly retryable: boolean
  constructor(message: string, retryable: boolean) {
    super(message)
    this.retryable = retryable
  }
}

async function call<T>(cfg: ScriptConfig, action: string, payload: Record<string, unknown> = {}): Promise<T> {
  // Apps Script answers a POST with a redirect to the response, which fetch
  // follows as a GET. The script has already run by then.
  let res: Response
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ ...payload, action, secret: cfg.secret }),
      redirect: 'follow',
    })
  } catch (err) {
    throw new SheetsScriptError(`sheets script unreachable: ${String(err)}`, true)
  }

  const text = await res.text()
  if (!res.ok) throw new SheetsScriptError(`sheets script ${res.status}: ${text.slice(0, 300)}`, true)

  let body: { ok?: boolean; error?: string; retry?: boolean } & T
  try {
    body = JSON.parse(text)
  } catch {
    // An HTML page instead of JSON: a Google error or sign-in page, usually
    // because the deployment is not set to "Anyone". Retrying won't fix it.
    throw new SheetsScriptError(`sheets script answered with non-JSON: ${text.slice(0, 200)}`, false)
  }
  if (!body.ok) throw new SheetsScriptError(`sheets script: ${body.error ?? 'failed'}`, !!body.retry)
  return body
}

export type SheetValue = string | number

/** Every tagged sheet in the folder. */
export async function listSheets(cfg: ScriptConfig): Promise<{ event: string; id: string }[]> {
  const body = await call<{ sheets: { event: string; id: string }[] }>(cfg, 'list')
  return body.sheets ?? []
}

/**
 * Replace one sheet's first tab with `grid`, clearing anything beyond it.
 *
 * `version` orders writes: the script ignores one older than the last it
 * applied, so two syncs racing never leave the older list on screen. Returns
 * false when this write was the older one.
 */
export async function writeSheet(
  cfg: ScriptConfig,
  id: string,
  grid: SheetValue[][],
  version: number,
): Promise<boolean> {
  const body = await call<{ skipped?: boolean }>(cfg, 'write', { id, grid, version })
  return !body.skipped
}

export const sheetUrl = (spreadsheetId: string) =>
  `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
