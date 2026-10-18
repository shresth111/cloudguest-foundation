import { useId } from "react";
import type { CSSProperties } from "react";

/**
 * Sign-in scene: a small Wyfy Guest "street" -- a coworking studio, a café
 * with a router on its counter, and a hotel with a WiFi mast on the roof,
 * joined by one footpath with Wyfy shield-mark pins standing on it. A guest
 * on the path holds a phone with an OTP bubble above it.
 *
 * Style follows the illustration system of the EkamOS website / sign-in art
 * (flat vector, no outlines, soft sky gradient with a haloed sun, drifting
 * clouds, round trees, bobbing pins on a dotted path, CSS-only motion that
 * switches off under prefers-reduced-motion). Colours are Wyfy Guest's own:
 * the violet primary (#6C4EFF), the indigo->purple mark gradient, lilac
 * tints and the cyan signal accent.
 *
 * Lighting: buildings are drawn in daylight colours, a full-bleed <Shade/>
 * tints them for night, then the "light layer" (glass, interiors, signal
 * waves, pins, the OTP bubble) is drawn on top so it can glow after dark.
 *
 * Purely decorative (aria-hidden): the panel around it carries the copy.
 * Loaded lazily by AuthScenePanel so it never lands in an eager chunk.
 */

export type LoginSceneTime = "day" | "night";

// One space-separated value per key, per time of day.
const KEYS =
  "sky1 sky2 sun far near shade shadeop lit frame glint halo stars moon sunop cloud cloudop".split(
    " ",
  );
const PALETTE: Record<LoginSceneTime, string> = {
  day: "#c9c2ff #f6f3ff #fff1c2 #d9d2fa #c3e6dc #ffffff 0 #f3f0ff #a59bdc .7 0 0 0 1 #ffffff .92",
  night:
    "#221d5e #43358f #ffffff #2f2a70 #26405f #110e3a .48 #efe9ff #7b74b6 0 .6 1 1 0 #4a4396 .5",
};

const CSS = `
.wg-sway{transform-box:fill-box;transform-origin:50% 100%;animation:wg-sway 6s ease-in-out infinite alternate}
.wg-drift{animation:wg-drift 38s ease-in-out infinite alternate}
.wg-tw{animation:wg-tw 3.4s ease-in-out infinite}
.wg-bob{animation:wg-bob 2.8s ease-in-out infinite alternate}
.wg-wave{animation:wg-wave 2.4s ease-in-out infinite}
.wg-caret{animation:wg-caret 1.1s steps(1) infinite}
.wg-steam{animation:wg-steam 3.6s ease-out infinite}
@keyframes wg-sway{from{transform:rotate(-1.4deg)}to{transform:rotate(1.4deg)}}
@keyframes wg-drift{to{transform:translateX(22px)}}
@keyframes wg-tw{50%{opacity:.35}}
@keyframes wg-bob{to{transform:translateY(-3px)}}
@keyframes wg-wave{0%,100%{opacity:.2}40%{opacity:1}}
@keyframes wg-caret{50%{opacity:0}}
@keyframes wg-steam{0%{transform:translateY(3px);opacity:0}35%{opacity:.85}100%{transform:translateY(-7px);opacity:0}}
@media (prefers-reduced-motion:reduce){.wg-sway,.wg-drift,.wg-tw,.wg-bob,.wg-wave,.wg-caret,.wg-steam{animation:none}}
`;

const v = (k: string) => `var(--wg-${k})`;
const op = (k: string): CSSProperties => ({ opacity: v(k) });

// Wyfy Guest palette (brand) + a few natural neutrals (skin, wood, leaves).
const C = {
  violet: "#6C4EFF",
  violetD: "#5137e0",
  indigo: "#6366f1",
  purple: "#7c3aed",
  lilac: "#c4b5fd",
  lilacL: "#e7e1ff",
  wall: "#f8f6ff",
  wall2: "#ebe6fb",
  plum: "#3b3570",
  ink: "#1e1b4b",
  cyan: "#22d3ee",
  cyanD: "#0ea5c6",
  fuchsia: "#e879f9",
  pink: "#f5b4f7",
  leaf: "#7cc4ad",
  leafD: "#4f9f8c",
  leafL: "#a7dcc9",
  trunk: "#6e5a86",
  wood: "#b8916c",
  woodD: "#8d6a4f",
  skin: "#e8bf9c",
  skin2: "#c68c66",
  hair: "#2b2440",
  screen: "#dfe0f3",
  white: "#ffffff",
};

const arch = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y + h}V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V${y + h}z`;
const arc = (x: number, y: number, r: number) => `M${x - r} ${y}A${r} ${r} 0 0 1 ${x + r} ${y}`;

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M4 0a10 10 0 0 1 6-18 16 16 0 0 1 30-5 12 12 0 0 1 20 9 8 8 0 0 1-2 14z"
    />
  );
}

function Tree({
  x,
  y = 262,
  s = 1,
  c = C.leaf,
  d = C.leafD,
}: {
  x: number;
  y?: number;
  s?: number;
  c?: string;
  d?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-4 0l1.5-44h5L4 0z" fill={C.trunk} />
      <g className="wg-sway">
        <circle cx={-17} cy={-46} r={17} fill={d} />
        <circle cx={0} cy={-60} r={24} fill={c} />
        <circle cx={17} cy={-45} r={18} fill={c} />
        <circle cx={-6} cy={-68} r={10} fill={C.white} fillOpacity={0.2} />
      </g>
    </g>
  );
}

function Cypress({ x, s = 1 }: { x: number; s?: number }) {
  return (
    <g transform={`translate(${x} 262) scale(${s})`}>
      <path d="M0 0v-12" stroke={C.trunk} strokeWidth={3} />
      <path className="wg-sway" d="M0-86C14-66 15-30 10-12H-10C-15-30-14-66 0-86z" fill={C.leafD} />
    </g>
  );
}

function Pot({ x, y = 262, s = 1 }: { x: number; y?: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        d="M0-14C-10-30-4-40 0-44 4-40 10-30 0-14zM0-14c-16-8-18-18-16-24 8 2 14 10 16 24zM0-14c16-8 18-18 16-24-8 2-14 10-16 24z"
        fill={C.leaf}
      />
      <path d="M-8-14h16l-2 14H-6z" fill={C.violetD} />
    </g>
  );
}

// Signal arcs that light up one after another, smallest first.
function Waves({ x, y, r, w = 2.5 }: { x: number; y: number; r: number[]; w?: number }) {
  return (
    <g stroke={C.cyan} strokeWidth={w} strokeLinecap="round" fill="none">
      {r.map((rr, k) => (
        <path
          key={rr}
          d={arc(x, y, rr)}
          className="wg-wave"
          style={{ animationDelay: `${k * 0.35}s` }}
        />
      ))}
    </g>
  );
}

// The Wyfy Guest shield mark, standing on the footpath like a map pin.
function Pin({ x, y = 290, g, delay = 0 }: { x: number; y?: number; g: string; delay?: number }) {
  const s = 1.25;
  return (
    <g>
      <ellipse cx={x} cy={y + 1} rx={9} ry={2.4} fill={C.ink} fillOpacity={0.14} />
      <g className="wg-bob" style={{ animationDelay: `${delay}s` }}>
        <g transform={`translate(${x - 12 * s} ${y - 23.5 * s}) scale(${s})`}>
          <path
            d="M12 1.2 L20.5 4.6 V11 C20.5 16.6 17 20.8 12 22.6 C7 20.8 3.5 16.6 3.5 11 V4.6 Z"
            fill={`url(#${g})`}
          />
          <circle cx={12} cy={14.6} r={1.35} fill={C.white} />
          <path
            d="M8.6 12.1a5 5 0 0 1 6.8 0M6.3 9.3a8.6 8.6 0 0 1 11.4 0"
            stroke={C.white}
            strokeWidth={1.7}
            strokeLinecap="round"
          />
        </g>
      </g>
    </g>
  );
}

// A seated/standing figure's upper body (torso + head + hair), facing us.
function Bust({
  x,
  y,
  s = 1,
  top,
  hair = C.hair,
  skin = C.skin,
}: {
  x: number;
  y: number;
  s?: number;
  top: string;
  hair?: string;
  skin?: string;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-12 0c0-16 5-24 12-24s12 8 12 24z" fill={top} />
      <circle cx={0} cy={-31} r={7.5} fill={skin} />
      <path d="M-7.5-32a7.5 7.5 0 0 1 15 0c-4-4.5-11-5.5-15 0z" fill={hair} />
    </g>
  );
}

const STARS = [
  [40, 34],
  [96, 18],
  [168, 46],
  [232, 24],
  [300, 58],
  [356, 16],
  [452, 30],
  [510, 58],
  [546, 20],
  [688, 22],
  [764, 44],
  [24, 92],
  [276, 96],
  [470, 96],
  [720, 110],
  [150, 108],
];

function Sky({ g }: { g: string }) {
  return (
    <>
      <rect width={800} height={320} fill={`url(#${g})`} />
      <g fill={C.white} style={op("stars")}>
        {STARS.map(([x, y], k) => (
          <circle
            key={k}
            cx={x}
            cy={y}
            r={k % 3 ? 1.2 : 1.9}
            className="wg-tw"
            style={{ animationDelay: `${((k * 0.7) % 3.4).toFixed(1)}s` }}
          />
        ))}
      </g>
      <g style={op("sunop")}>
        <circle cx={730} cy={60} r={46} fill={v("sun")} fillOpacity={0.2} />
        <circle cx={730} cy={60} r={32} fill={v("sun")} fillOpacity={0.35} />
        <circle cx={730} cy={60} r={21} fill={v("sun")} />
      </g>
      <g style={op("moon")}>
        <circle cx={730} cy={60} r={34} fill="#f3eeff" fillOpacity={0.08} />
        <path d="M736 42a18 18 0 1 0 12 30 15 15 0 0 1-12-30z" fill="#f3eeff" />
      </g>
      <g className="wg-drift" fill={v("cloud")} style={op("cloudop")}>
        <Cloud x={92} y={76} s={1.1} />
        <Cloud x={396} y={50} s={0.8} />
        <Cloud x={250} y={112} s={0.6} />
      </g>
    </>
  );
}

function Land() {
  return (
    <>
      <path
        d="M0 214C100 186 190 196 270 208S440 184 540 200 700 180 800 202V264H0z"
        fill={v("far")}
      />
      <path
        d="M0 236C110 220 220 228 330 236S560 218 660 228 760 226 800 230V264H0z"
        fill={v("near")}
      />
      <path d="M0 258H800V320H0z" fill="#efeaf8" />
      <path d="M0 276C200 268 600 268 800 276V306C600 298 200 298 0 306z" fill="#e2dbf3" />
      <path d="M0 306C200 298 600 298 800 306V320H0z" fill="#d8cfee" fillOpacity={0.7} />
      <path
        d="M0 291C200 283 600 283 800 291"
        stroke={C.violet}
        strokeOpacity={0.4}
        strokeWidth={3}
        strokeDasharray="2 9"
        strokeLinecap="round"
      />
    </>
  );
}

// ---------- daylight bodies (shaded at night) ----------

function Coworking() {
  return (
    <>
      <rect x={36} y={142} width={154} height={120} fill={C.wall} />
      <rect x={30} y={134} width={166} height={9} rx={2} fill={C.plum} />
      <rect x={32} y={258} width={162} height={6} fill={C.wall2} />
      <Pot x={58} y={134} s={0.55} />
      <Pot x={170} y={134} s={0.55} />
    </>
  );
}

function Cafe() {
  const stripes = 9;
  const sw = 186 / stripes;
  return (
    <>
      <path d="M236 152l20-24h198l20 24z" fill={C.violetD} />
      <path d="M250 136h210M243 144h224" stroke="#4630c4" strokeWidth={1.5} />
      <rect x={250} y={152} width={210} height={110} fill={C.wall} />
      <rect x={318} y={156} width={74} height={15} rx={4} fill={C.violet} />
      <path
        d="M349 159.5h9v4a4.5 4.5 0 0 1-9 0zM358 161h2a1.6 1.6 0 0 1 0 3.2h-2"
        stroke={C.white}
        strokeWidth={1.4}
      />
      {Array.from({ length: stripes }, (_, k) => (
        <g key={k} fill={k % 2 ? C.lilacL : C.violet}>
          <rect x={262 + k * sw} y={176} width={sw} height={13} />
          <path d={`M${262 + k * sw} 189a${sw / 2} 6 0 0 0 ${sw} 0z`} />
        </g>
      ))}
      <rect x={412} y={196} width={36} height={66} fill={C.plum} />
      <rect x={266} y={248} width={140} height={8} rx={2} fill={C.wood} />
      <path
        d="M274 256c0 6 2 9 5 11M300 256c0 5-2 8-4 10M330 256c0 6 3 9 6 10M362 256c0 5-2 8-5 10M392 256c0 6 2 9 5 10"
        stroke={C.leafD}
        strokeWidth={3}
        strokeLinecap="round"
      />
    </>
  );
}

function Terrace() {
  return (
    <>
      <g stroke={C.woodD} strokeWidth={2.5} strokeLinecap="round">
        <path d="M492 206v56M484 262h16" />
        <path d="M478 244l-2 18M510 244l2 18" />
        <path d="M466 248l2 14M462 248h10" />
      </g>
      <path d="M462 210c8-18 52-18 60 0z" fill={C.violet} />
      <path d="M484 210c3-14 13-14 16 0z" fill={C.lilacL} />
    </>
  );
}

function Hotel() {
  return (
    <>
      <rect x={530} y={146} width={40} height={116} fill={C.wall2} />
      <rect x={660} y={146} width={40} height={116} fill={C.wall2} />
      <path d="M526 146h48v-7h-48zM656 146h48v-7h-48z" fill={C.violetD} />
      <rect x={570} y={104} width={90} height={158} fill={C.wall} />
      <rect x={564} y={96} width={102} height={9} rx={2} fill={C.violet} />
      <path
        d={Array.from({ length: 6 }, (_, k) => `M${569 + k * 16} 96a8 7 0 0 1 16 0z`).join("")}
        fill={C.lilacL}
      />
      <rect x={604} y={82} width={22} height={9} rx={2} fill={C.wall2} />
      <path
        d="M615 82V52M608 70h14M610 62h10"
        stroke={C.plum}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <path d="M594 214h42v8h-42z" fill={C.violet} />
      <path
        d={Array.from({ length: 6 }, (_, k) => `M${594 + k * 7} 222a3.5 3 0 0 0 7 0z`).join("")}
        fill={C.violet}
      />
      <path d="M598 256h34v6h-34z" fill={C.wall2} />
      <g>
        {[
          [566, 104, 7],
          [576, 101, 6],
          [559, 112, 5],
          [586, 100, 4],
          [571, 114, 4],
        ].map(([x, y, r], k) => (
          <circle
            key={k}
            cx={x}
            cy={y}
            r={r}
            fill={k % 3 === 2 ? C.leafD : C.fuchsia}
            fillOpacity={1 - k * 0.07}
          />
        ))}
      </g>
      <Pot x={550} s={0.7} />
      <Pot x={680} s={0.7} />
    </>
  );
}

// ---------- light layer (glows at night) ----------

function Win({
  x,
  y,
  w,
  h,
  a = false,
  m = true,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  a?: boolean;
  m?: boolean;
}) {
  const d = a ? arch(x, y, w, h) : `M${x} ${y}h${w}v${h}h${-w}z`;
  return (
    <g>
      <path d={d} stroke={v("lit")} strokeWidth={7} strokeLinejoin="round" style={op("halo")} />
      <path d={d} fill={v("lit")} stroke={v("frame")} strokeWidth={2} />
      <path
        d={`M${x + w * 0.28} ${y + h * 0.82}l${w * 0.44} ${-h * 0.46}`}
        stroke={C.white}
        strokeWidth={2.2}
        strokeLinecap="round"
        style={op("glint")}
      />
      {m && (
        <path
          d={`M${x + w / 2} ${y + (a ? w / 2 : 0)}V${y + h}`}
          stroke={v("frame")}
          strokeWidth={1.5}
        />
      )}
    </g>
  );
}

function Lamp({ x, y, c = C.violet }: { x: number; y: number; c?: string }) {
  return (
    <g>
      <path d={`M${x} ${y}v7`} stroke={C.plum} strokeWidth={1.2} />
      <circle cx={x} cy={y + 12} r={9} fill="#fff4cf" style={op("halo")} />
      <path d={`M${x - 6} ${y + 12}a6 5 0 0 1 12 0z`} fill={c} />
      <circle cx={x} cy={y + 13} r={1.6} fill="#fff4cf" />
    </g>
  );
}

function CoworkingLight() {
  return (
    <>
      <Win x={46} y={152} w={134} h={46} m={false} />
      <path d="M91 152v46M135 152v46" stroke={v("frame")} strokeWidth={2} />
      <Lamp x={68} y={152} />
      <Lamp x={113} y={152} c={C.cyanD} />
      <Lamp x={158} y={152} />
      <path d="M98 186h30" stroke={C.wood} strokeWidth={2.5} />
      {[
        [100, 7, 10, C.violet],
        [108, 6, 13, C.cyan],
        [115, 7, 9, C.fuchsia],
        [123, 5, 12, C.plum],
      ].map(([x, w, h, c]) => (
        <rect
          key={x as number}
          x={x as number}
          y={185 - (h as number)}
          width={w as number}
          height={h as number}
          rx={1}
          fill={c as string}
        />
      ))}
      <Win x={46} y={208} w={88} h={50} m={false} />
      <Bust x={112} y={240} top={C.violet} />
      <rect x={54} y={238} width={76} height={4} rx={1.5} fill={C.wood} />
      <path d="M78 238l3-14h20l-3 14z" fill={C.screen} />
      <circle cx={90} cy={231} r={1.8} fill={C.violet} />
      <Waves x={90} y={220} r={[4, 8]} w={1.8} />
      <Pot x={64} y={238} s={0.45} />
      <Win x={142} y={208} w={38} h={50} />
      <circle cx={156} cy={234} r={1.6} fill={C.plum} />
      <circle cx={166} cy={234} r={1.6} fill={C.plum} />
    </>
  );
}

function CafeLight() {
  return (
    <>
      <Win x={270} y={196} w={132} h={50} m={false} />
      <path d="M280 212h40" stroke={C.wood} strokeWidth={2} />
      {[283, 293, 303, 313].map((x, k) => (
        <rect
          key={x}
          x={x}
          y={204}
          width={6}
          height={8}
          rx={1.5}
          fill={k % 2 ? C.lilac : C.violetD}
        />
      ))}
      <rect x={276} y={232} width={68} height={14} fill={C.wood} />
      <rect x={276} y={230} width={68} height={3} fill={C.woodD} />
      {/* The router on the counter, broadcasting. */}
      <path d="M300 222l-3-10M314 222l3-10" stroke={C.ink} strokeWidth={2} strokeLinecap="round" />
      <rect x={296} y={221} width={22} height={9} rx={2.5} fill={C.ink} />
      {[301, 307, 313].map((x, k) => (
        <circle
          key={x}
          cx={x}
          cy={225.5}
          r={1.3}
          fill={C.cyan}
          className="wg-tw"
          style={{ animationDelay: `${k * 0.5}s` }}
        />
      ))}
      <Waves x={307} y={214} r={[5, 10, 15]} w={2.2} />
      <Lamp x={350} y={196} />
      <Lamp x={388} y={196} c={C.cyanD} />
      {/* A guest inside, checking their phone. */}
      <Bust x={370} y={246} top={C.fuchsia} hair={C.plum} skin={C.skin2} />
      <path d="M376 236q7-3 7-11" stroke={C.fuchsia} strokeWidth={4} strokeLinecap="round" />
      <rect x={380} y={214} width={7} height={11} rx={1.5} fill={C.ink} />
      <rect x={381.2} y={215.5} width={4.6} height={7} rx={0.8} fill={C.cyan} />
      <path d="M270 246l50-50h26l-50 50z" fill={C.white} fillOpacity={0.25} style={op("glint")} />
      <path d="M270 196h132v50H270zM336 196v50" stroke={v("frame")} strokeWidth={3} />
      <Win x={418} y={202} w={24} h={40} m={false} />
      <circle cx={443} cy={248} r={1.8} fill={C.lilac} />
    </>
  );
}

function TerraceLight() {
  return (
    <>
      <Bust x={470} y={250} s={0.8} top={C.cyanD} />
      <ellipse cx={494} cy={241} rx={18} ry={3} fill={C.wall2} />
      <path d="M495 239l2-11h13l-2 11z" fill={C.screen} />
      <circle cx={503} cy={233.5} r={1.4} fill={C.violet} />
      <path d="M482 232h7v7h-7zM489 234h2a1.5 1.5 0 0 1 0 3h-2" fill={C.violetD} />
      <g stroke={C.white} strokeWidth={1.6} strokeLinecap="round">
        {[0, 1].map((k) => (
          <path
            key={k}
            className="wg-steam"
            style={{ animationDelay: `${k * 1.8}s` }}
            d={`M${484 + k * 4} 228c-3-3 3-5 0-8s3-5 0-8`}
          />
        ))}
      </g>
      <Waves x={503} y={222} r={[4, 8]} w={1.8} />
    </>
  );
}

function HotelLight() {
  return (
    <>
      {[158, 190, 222].map((y) => (
        <g key={y}>
          <Win x={540} y={y} w={20} h={22} m={false} />
          <Win x={670} y={y} w={20} h={22} m={false} />
        </g>
      ))}
      {[118, 160].map((y) =>
        [582, 605, 628].map((x) => <Win key={`${x}${y}`} x={x} y={y} w={20} h={28} a />),
      )}
      <Win x={576} y={224} w={16} h={28} a m={false} />
      <Win x={638} y={224} w={16} h={28} a m={false} />
      <path d={arch(603, 226, 24, 30)} fill={v("lit")} stroke={v("frame")} strokeWidth={2} />
      <path d="M615 238v18" stroke={v("frame")} strokeWidth={1.5} />
      {/* Rooftop access point: the beacon blinks, the waves pulse out. */}
      <circle cx={615} cy={50} r={9} fill={C.cyan} fillOpacity={0.25} style={op("halo")} />
      <circle cx={615} cy={50} r={3.5} fill={C.cyan} className="wg-tw" />
      <Waves x={615} y={50} r={[12, 22, 32]} w={2.6} />
    </>
  );
}

function Guest({ g }: { g: string }) {
  return (
    <>
      {/* A guest on the footpath, phone in hand... */}
      <ellipse cx={236} cy={299} rx={12} ry={2.6} fill={C.ink} fillOpacity={0.14} />
      <path d="M230 282h5v16h-5zM238 282h5v16h-5z" fill={C.ink} />
      <path d="M225 286c0-18 4-29 11-29s11 11 11 29z" fill={C.violet} />
      <circle cx={236} cy={248} r={8} fill={C.skin} />
      <path d="M228 247a8 8 0 0 1 16 0c-3-2-5-6-5-6-3 4-8 6-11 6z" fill={C.hair} />
      <path d="M243 266q9-5 8-16" stroke={C.violet} strokeWidth={4.5} strokeLinecap="round" />
      <rect x={247} y={238} width={8} height={13} rx={2} fill={C.ink} />
      <rect x={248.3} y={239.6} width={5.4} height={8.6} rx={1} fill={C.cyan} />
      {/* ...and the OTP it just received. */}
      <g className="wg-bob" style={{ animationDelay: "0.6s" }}>
        <rect x={192} y={194} width={70} height={34} rx={9} fill={C.ink} fillOpacity={0.1} />
        <rect x={190} y={190} width={70} height={34} rx={9} fill={C.white} />
        <path d="M240 223h12l-3 9z" fill={C.white} />
        {[197, 211, 225, 239].map((x, k) => (
          <g key={x}>
            <rect
              x={x}
              y={199}
              width={12}
              height={16}
              rx={3}
              fill={C.lilacL}
              stroke={k === 3 ? C.violet : C.lilac}
              strokeWidth={k === 3 ? 1.5 : 1}
            />
            {k < 3 ? (
              <circle cx={x + 6} cy={207} r={2.3} fill={C.ink} />
            ) : (
              <path
                d={`M${x + 6} 202.5v9`}
                stroke={C.violet}
                strokeWidth={1.4}
                strokeLinecap="round"
                className="wg-caret"
              />
            )}
          </g>
        ))}
        <circle cx={259} cy={191} r={7} fill={`url(#${g})`} />
        <path
          d="M255.8 191.2l2.2 2.2 4-4.2"
          stroke={C.white}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </>
  );
}

const Shade = () => <rect width={800} height={320} fill={v("shade")} style={op("shadeop")} />;

export default function LoginSceneIllustration({
  timeOfDay = "day",
  className = "h-auto w-full",
}: {
  timeOfDay?: LoginSceneTime;
  className?: string;
}) {
  const raw = useId().replace(/[^a-zA-Z0-9]/g, "");
  const g = `wg${raw}`;
  const vals = PALETTE[timeOfDay].split(" ");
  const style = Object.fromEntries(KEYS.map((k, i) => [`--wg-${k}`, vals[i]])) as CSSProperties;
  return (
    <svg
      viewBox="0 0 800 320"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={style}
      data-time={timeOfDay}
    >
      <style>{CSS}</style>
      <defs>
        <linearGradient id={`${g}sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={v("sky1")} />
          <stop offset=".85" stopColor={v("sky2")} />
        </linearGradient>
        <linearGradient id={`${g}mark`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={C.indigo} />
          <stop offset="1" stopColor={C.purple} />
        </linearGradient>
      </defs>
      <Sky g={`${g}sky`} />
      <Land />
      <Tree x={14} s={0.95} />
      <Coworking />
      <Pot x={204} s={0.8} />
      <Cafe />
      <Terrace />
      <Hotel />
      <Tree x={738} s={1.15} c={C.leafL} d={C.leaf} />
      <Cypress x={784} s={0.85} />
      <Shade />
      <CoworkingLight />
      <CafeLight />
      <TerraceLight />
      <HotelLight />
      <Pin x={113} g={`${g}mark`} />
      <Pin x={356} g={`${g}mark`} delay={0.9} />
      <Pin x={615} g={`${g}mark`} delay={1.8} />
      <Guest g={`${g}mark`} />
    </svg>
  );
}
