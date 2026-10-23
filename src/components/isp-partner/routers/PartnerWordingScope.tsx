/**
 * QA-023 / D11: shows the shared router-setup UI in partner wording.
 *
 * `RouterSetupDrilldown` is mounted unchanged (it is the Master component),
 * so its own words, toasts and `window.confirm/prompt/alert` texts name
 * the tunnel technology and tunnel IPs. While this scope is mounted:
 *  - text nodes inside it, and inside the toast region (sonner renders in a
 *    portal), are passed through `partnerWording`, including the ones React
 *    writes later;
 *  - `window.confirm/prompt/alert` messages are passed through it, while the
 *    return values are untouched. A typed acknowledgement phrase contains no
 *    platform term, so it is shown and graded exactly as before.
 * Skipped: pre, code, kbd, samp, textarea, input, and anything inside
 * `[data-partner-wording="raw"]`. The generated RouterOS script still
 * configures the tunnel; only the words on screen change.
 */
import { useEffect, useRef, type ReactNode } from "react";
import { partnerWording } from "@/lib/isp-partner/partner-wording";

const SKIP = "pre, code, kbd, samp, textarea, input, script, style, [data-partner-wording='raw']";
const TOASTS = "[data-sonner-toaster]";

function rewriteNode(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const parent = node.parentElement;
    if (!parent || parent.closest(SKIP)) return;
    const before = node.nodeValue ?? "";
    const after = partnerWording(before);
    if (after !== before) node.nodeValue = after;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as Element;
  if (el.matches(SKIP)) return;
  for (const attr of ["title", "aria-label", "placeholder"]) {
    const v = el.getAttribute(attr);
    if (v) {
      const w = partnerWording(v);
      if (w !== v) el.setAttribute(attr, w);
    }
  }
  el.childNodes.forEach(rewriteNode);
}

export function PartnerWordingScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || typeof window === "undefined") return;

    const inScope = (n: Node) => {
      const el = n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
      return !!el && (root.contains(el) || !!el.closest(TOASTS));
    };
    rewriteNode(root);
    document.querySelectorAll(TOASTS).forEach(rewriteNode);
    const observer = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") {
          if (inScope(r.target)) rewriteNode(r.target);
        } else {
          r.addedNodes.forEach((n) => {
            if (inScope(n)) rewriteNode(n);
          });
        }
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });

    const { confirm, prompt, alert } = window;
    window.confirm = (message?: string) =>
      confirm.call(window, partnerWording(String(message ?? "")));
    window.prompt = (message?: string, def?: string) =>
      prompt.call(window, partnerWording(String(message ?? "")), def);
    window.alert = (message?: unknown) => alert.call(window, partnerWording(String(message ?? "")));
    return () => {
      observer.disconnect();
      window.confirm = confirm;
      window.prompt = prompt;
      window.alert = alert;
    };
  }, []);

  return (
    <div ref={ref} data-partner-wording="scope">
      {children}
    </div>
  );
}
