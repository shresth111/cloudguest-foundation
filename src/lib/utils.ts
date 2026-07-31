import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** `navigator.clipboard.writeText` only exists (and resolves) in a secure
 * context (HTTPS or localhost) -- on a plain-HTTP deployment it's either
 * `undefined` or rejects, so every "Copy" button silently throws instead of
 * copying. Falls back to the legacy `document.execCommand("copy")` path (a
 * hidden, off-screen textarea) when the modern API isn't available or
 * fails. Returns whether the copy actually succeeded, so callers can show
 * an accurate toast. */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through to the legacy path below -- e.g. NotAllowedError on a
      // non-secure (HTTP) origin, where the API exists but always rejects.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  // Off-screen but NOT display:none/visibility:hidden -- some browsers
  // (notably iOS Safari) refuse to select() or copy from an element that
  // isn't actually rendered/focusable.
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.width = "1px";
  textarea.style.height = "1px";
  textarea.style.padding = "0";
  textarea.style.opacity = "0";
  textarea.setAttribute("readonly", "");
  document.body.appendChild(textarea);

  const previousFocus = document.activeElement as HTMLElement | null;
  textarea.focus();
  textarea.select();
  // iOS Safari ignores select() on a textarea unless the selection range
  // is set explicitly.
  textarea.setSelectionRange(0, textarea.value.length);

  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }

  document.body.removeChild(textarea);
  previousFocus?.focus();
  return ok;
}
