/**
 * Copies `text` to the clipboard. Tries the modern async API first, then
 * falls back to a hidden-textarea + `document.execCommand('copy')` for
 * non-secure contexts (older browsers, http:// production deploys without
 * TLS). Returns `true` if either path succeeded, `false` if both failed.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to legacy path
    }
  }

  if (typeof document === 'undefined') return false;

  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.top = '-1000px';
  el.style.left = '-1000px';
  document.body.appendChild(el);
  el.select();
  try {
    const ok = document.execCommand('copy');
    return ok;
  } catch {
    return false;
  } finally {
    document.body.removeChild(el);
  }
}
