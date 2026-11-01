/**
 * Router history charts (ADDENDUM_05 J13/J20). Reached only through `lazy()`
 * from `RouterNetworkPanel`, so recharts stays off the router route's critical
 * path.
 *
 * One measure per chart (no dual axis): CPU %, memory %, and per-interface
 * throughput (download/upload, two series with a legend and tooltip). Lines,
 * not areas: a gap in polling is not bridged by a filled slope.
 */
import { useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { M_INPUT } from "@/components/master/MasterKit";
import type { RouterHistory } from "@/services/isp-partner/network-types";

const AXIS_TICK = { fontSize: 10, fill: "var(--muted-foreground)" } as const;
const H = 180;

const tick = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
const full = (iso: unknown) =>
  typeof iso === "string"
    ? new Date(iso).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 11,
  color: "var(--popover-foreground)",
} as const;

function PercentChart({
  title,
  data,
  dataKey,
  color,
}: {
  title: string;
  data: RouterHistory["points"];
  dataKey: "cpu_percent" | "memory_percent";
  color: string;
}) {
  const has = data.some((p) => p[dataKey] !== null);
  return (
    <figure className="space-y-1">
      <figcaption className="text-xs font-semibold text-foreground">{title}</figcaption>
      {!has ? (
        <p className="text-xs text-muted-foreground">No readings in this window.</p>
      ) : (
        <ResponsiveContainer width="100%" height={H}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis dataKey="at" tickFormatter={tick} tick={AXIS_TICK} minTickGap={32} />
            <YAxis domain={[0, 100]} unit="%" tick={AXIS_TICK} width={44} />
            <Tooltip
              labelFormatter={full}
              formatter={(v) => [`${v}%`, title]}
              contentStyle={TOOLTIP_STYLE}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              name={title}
              stroke={color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </figure>
  );
}

export default function RouterHistoryCharts({ history }: { history: RouterHistory }) {
  const names = Object.keys(history.interfaces).sort();
  const [iface, setIface] = useState(names[0] ?? "");
  const series = history.interfaces[iface] ?? [];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <PercentChart
          title="CPU"
          data={history.points}
          dataKey="cpu_percent"
          color="var(--chart-1)"
        />
        <PercentChart
          title="Memory"
          data={history.points}
          dataKey="memory_percent"
          color="var(--chart-1)"
        />
      </div>
      <figure className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <figcaption className="text-xs font-semibold text-foreground">
            Interface traffic (Mbps)
          </figcaption>
          {names.length > 0 && (
            <select
              className={`${M_INPUT} w-auto py-1`}
              value={iface}
              aria-label="Interface"
              onChange={(e) => setIface(e.target.value)}
            >
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          )}
        </div>
        {history.interfaces_source === "none" || names.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No traffic history for this router. Traffic graphs need SNMP polling switched on for it;
            the live read above shows the current rates.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={H + 20}>
            <LineChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
              <XAxis dataKey="at" tickFormatter={tick} tick={AXIS_TICK} minTickGap={32} />
              <YAxis tick={AXIS_TICK} width={44} />
              <Tooltip
                labelFormatter={full}
                formatter={(v, n) => [`${v} Mbps`, n]}
                contentStyle={TOOLTIP_STYLE}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="in_mbps"
                name="In"
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="out_mbps"
                name="Out"
                stroke="var(--chart-2)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </figure>
    </div>
  );
}
