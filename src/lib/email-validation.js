/* =================================================================== *
 * skin.theory — email validation
 * -------------------------------------------------------------------
 * Two independent checks, both must pass:
 *
 *   1. FORMAT — a practical, RFC 5322-tolerant pattern (the same class of
 *      regex browsers use for <input type="email">, tightened further).
 *      Catches: missing @, no TLD, consecutive dots, leading/trailing
 *      dots in the local part, malformed domain labels.
 *
 *   2. DISPOSABLE DOMAIN — a curated blocklist of known temp-mail
 *      providers. This list is NOT exhaustive — new disposable services
 *      appear constantly — so treat it as "catches the common, well-known
 *      ones," not a complete filter. Extend DISPOSABLE_DOMAINS as new
 *      ones surface.
 *
 * Both failure modes must surface the SAME generic message to the
 * shopper ("Please enter a valid email address") — never call out
 * "disposable" or "fake" in the UI, which just teaches someone which
 * provider to try next. isValidEmail() is the one function call sites
 * should use; the two checks are exported separately only for testing.
 * =================================================================== */

/* Local part: standard unquoted dot-atom characters, but — unlike the
 * permissive browser-spec regex — explicitly forbids a leading dot,
 * trailing dot, or two dots in a row, which real mail providers reject at
 * signup even though the character class alone would allow them.
 *
 * Domain: one or more dot-separated labels, each 1–63 characters, each
 * starting and ending alphanumeric (no leading/trailing hyphen), and
 * REQUIRES at least two labels — i.e. an actual TLD. `user@localhost`
 * or `user@intranet` correctly fails this. */
const LOCAL_PART = "(?!\\.)(?:[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+)(?<!\\.)";
const DOMAIN_LABEL = "[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?";
const EMAIL_RE = new RegExp(
  `^(?!.*\\.\\.)${LOCAL_PART}@(?:${DOMAIN_LABEL}\\.)+${DOMAIN_LABEL}$`
);

export function isValidEmailFormat(email) {
  return EMAIL_RE.test(String(email ?? "").trim());
}

/* Common disposable/temp-mail providers — the well-known ones people
 * actually reach for. Domains only (subdomains of these are covered by
 * the endsWith check below, e.g. abc.mailinator.com). */
export const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "mailinator.net", "mailinator.org",
  "guerrillamail.com", "guerrillamail.net", "guerrillamail.org", "guerrillamail.biz",
  "guerrillamailblock.com", "sharklasers.com", "grr.la", "spam4.me", "pokemail.net",
  "10minutemail.com", "10minutemail.net", "10minutemail.co.za", "20minutemail.com",
  "temp-mail.org", "tempmail.com", "tempmail.net", "tempmail.plus", "tempmailo.com",
  "tempmail.dev", "tmpmail.org", "tmpmail.net", "tmpeml.com",
  "throwawaymail.com", "throwawaymail.net", "getnada.com", "nada.email",
  "yopmail.com", "yopmail.fr", "yopmail.net", "cool.fr.nf", "jetable.fr.nf",
  "trashmail.com", "trashmail.net", "trashmail.me", "trash-mail.com",
  "dispostable.com", "fakeinbox.com", "fakemailgenerator.com", "maildrop.cc",
  "mintemail.com", "mytemp.email", "moakt.com", "mohmal.com",
  "emailondeck.com", "spamgourmet.com", "getairmail.com", "mail-temporaire.fr",
  "minuteinbox.com", "meltmail.com", "burnermail.io", "inboxbear.com",
  "correotemporal.org", "einrot.com", "einrot.de", "wegwerfemail.de",
  "byom.de", "spambog.com", "spambog.de", "spambog.ru", "discard.email",
  "discardmail.com", "discardmail.de", "mailnesia.com", "mailcatch.com",
  "anonaddy.me", "33mail.com", "emailfake.com", "fakemail.net",
]);

export function isDisposableEmail(email) {
  const at = String(email ?? "").trim().toLowerCase().lastIndexOf("@");
  if (at === -1) return false;
  const domain = email.trim().toLowerCase().slice(at + 1);
  return DISPOSABLE_DOMAINS.has(domain) ||
    [...DISPOSABLE_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

/** The one function call sites should use. */
export function isValidEmail(email) {
  return isValidEmailFormat(email) && !isDisposableEmail(email);
}
