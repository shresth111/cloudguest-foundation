export const CHART_COLORS = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 45%)",
  "hsl(38, 92%, 55%)",
  "hsl(280, 87%, 65%)",
  "hsl(340, 82%, 60%)",
  "hsl(190, 90%, 50%)",
  "hsl(24, 94%, 55%)",
  "hsl(120, 60%, 45%)",
];

export const AXIS_STYLE = { fontSize: 11, fill: "var(--muted-foreground)" } as const;

export const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;
