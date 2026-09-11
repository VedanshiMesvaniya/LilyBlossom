/**
 * Validates that a `?next=` style redirect target is a real, same
 * site relative path, not an absolute URL or a value crafted to be
 * misread as one. Used by LoginPage.jsx, which otherwise passes a
 * fully attacker-controlled query param straight to navigate().
 *
 * This exists regardless of the installed react-router version: an
 * advisory (GHSA-wrjc-x8rr-h8h6) describes a backslash-based open
 * redirect in <Link>/useNavigate in some react-router releases, but
 * the same class of bug is possible in application code any time a
 * redirect target comes straight from the URL, so this validates the
 * value itself rather than only relying on the library being patched.
 *
 * Rejects:
 *   - empty/missing values                -> "/"
 *   - absolute URLs ("https://evil.example")
 *   - protocol-relative URLs ("//evil.example")
 *   - backslash tricks browsers can normalize to "//" ("/\evil.example", "\\evil.example")
 * Accepts only a path that starts with exactly one "/" and contains
 * no backslashes.
 */
export function sanitizeNextPath(value) {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  if (value.startsWith("//")) return "/";
  if (value.includes("\\")) return "/";
  return value;
}
