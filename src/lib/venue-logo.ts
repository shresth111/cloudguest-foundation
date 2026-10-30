/**
 * Sharpness cap for the guest portal's venue logo (`VenueLogo adaptive`).
 * Kept out of the component file so it stays a components-only module
 * (fast refresh) and so the regression test can call it directly.
 */
// How far past 1 image-pixel-per-device-pixel we let a small upload be
// stretched. 1.0 is "perfectly sharp" but renders a 96px upload at 32 CSS px
// on a 3x phone -- the postage stamp we are fixing. 1.5x bilinear upscale of
// a flat-colour logo is soft at the edges but not visibly pixelated at arm's
// length; past ~2x it is. SVG (resolution-independent) is never capped.
const MAX_UPSCALE = 1.5;
// ...but a tiny file still gets at least this many CSS px (or its own CSS
// size, if smaller), so a 64px upload on a 3x phone is not 32px.
const CAP_FLOOR_PX = 40;

export const isVectorUrl = (url: string) =>
  /^data:image\/svg\+xml/i.test(url) || /\.svg(?:[?#]|$)/i.test(url);

/** Largest CSS width this file can be drawn at without visible blur. */
export function venueLogoWidthCap(
  naturalWidth: number,
  devicePixelRatio: number,
  vector: boolean,
): number | null {
  if (vector || naturalWidth <= 0) return null;
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return Math.max(Math.min(naturalWidth, CAP_FLOOR_PX), (naturalWidth * MAX_UPSCALE) / dpr);
}
