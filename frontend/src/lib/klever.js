/**
 * Klever wallet integration via @klever/kleverweb
 *
 * The KleverWeb object is injected into the page as window.kleverWeb
 * by the Klever browser extension.
 *
 * For mobile wallet support, use Klever's deep link scheme:
 *   klever://...
 *
 * Docs: https://docs.klever.org/klever-blockchain/klever-js
 */

export function getKleverWeb() {
  return window.kleverWeb ?? null;
}

export function isKleverInstalled() {
  return typeof window !== 'undefined' && !!window.kleverWeb;
}

/**
 * Initialise the Klever extension and return the connected account.
 * Throws if the extension is not installed.
 *
 * Returns: { address: 'klv1...', name: string }
 */
export async function connectKleverWallet() {
  const kw = getKleverWeb();
  if (!kw) {
    throw new Error(
      'Klever Extension not found. Install it from https://klever.io/extension',
    );
  }

  await kw.initialize();
  const address = kw.getWalletAddress();

  if (!address) throw new Error('No account found in Klever Extension');
  return { address };
}

/**
 * Sign a plain text message with the currently connected Klever wallet.
 * Returns the hex-encoded 64-byte Ed25519 signature.
 */
export async function signMessage(message) {
  const kw = getKleverWeb();
  if (!kw) throw new Error('Klever Extension not available');
  const signature = await kw.signMessage(message);
  return signature;
}

/**
 * Get the currently connected account without triggering a connection prompt.
 * Returns null if not connected.
 */
export function getCurrentAccount() {
  try {
    const address = getKleverWeb()?.getWalletAddress();
    return address ? { address } : null;
  } catch {
    return null;
  }
}

/**
 * Shorten a klv1... address for display:  klv1abcd…ef12
 */
export function shortenKlvAddress(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 8)}…${addr.slice(-4)}`;
}

/**
 * Format a token amount from minimal units to a display string.
 * precision = number of decimal places the token was created with (0–18).
 */
export function formatKth(minimalUnits, precision = 6) {
  if (!minimalUnits && minimalUnits !== 0) return '0';
  const divisor = 10 ** precision;
  const val = Number(minimalUnits) / divisor;
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: Math.min(precision, 8) });
}
