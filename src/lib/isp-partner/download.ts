/** Browser-side file helpers for the partner console. */

/** Blob -> browser download. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Filename for the TR-069 script download: no spaces (RouterOS `/import` takes a bare name). */
export function tr069ScriptFilename(
  locationName: string | null | undefined,
  routerId: string,
  slug: (s: string) => string,
): string {
  return `tr069-${slug(locationName ?? "") || routerId}.rsc`;
}
