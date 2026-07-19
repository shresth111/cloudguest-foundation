import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartCard } from "./ChartCard";
import { CHART_COLORS, TOOLTIP_STYLE } from "./chart-theme";
import type { DeviceAnalytics, DistributionSlice } from "@/types/analytics";

interface Props {
  data?: DeviceAnalytics;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

function Donut({ items }: { items: DistributionSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={items} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
          {items.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DeviceAnalyticsPanel({ data, isLoading, isError, onRetry }: Props) {
  const state = { isLoading, isError, onRetry };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ChartCard title="Device types" description="Mobile, laptop, tablet, desktop" {...state}>
        <Donut items={data?.deviceTypes ?? []} />
      </ChartCard>
      <ChartCard title="Operating systems" {...state}>
        <Donut items={data?.operatingSystems ?? []} />
      </ChartCard>
      <ChartCard title="Browser distribution" {...state}>
        <Donut items={data?.browsers ?? []} />
      </ChartCard>
      <ChartCard title="Device vendors" {...state}>
        <Donut items={data?.vendors ?? []} />
      </ChartCard>
    </div>
  );
}
