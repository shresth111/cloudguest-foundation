/**
 * Codes from a pre-printed voucher file: one code per line, or the first
 * column of a CSV. A header cell named "code" (any case) is skipped, as are
 * blank lines and surrounding quotes. Normalisation (case, separators) and
 * duplicate checks are the backend's job (`POST /vouchers/import`).
 */
export function parseVoucherCodes(text: string): string[] {
  const codes: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const first = line
      .split(/[,;\t]/)[0]
      ?.trim()
      .replace(/^"(.*)"$/, "$1")
      .trim();
    if (!first) continue;
    if (codes.length === 0 && /^(voucher[ _]?)?codes?$/i.test(first)) continue;
    codes.push(first);
  }
  return codes;
}
