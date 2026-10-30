import { AlertTriangle, Calendar, Clock, Users } from "lucide-react";
import { fallbackTrend } from "@/lib/case-utils";
import type { ResolutionMetrics, TrendPoint } from "@/lib/types";
import { Panel } from "@/components/dashboard/ui";

const TIMEFRAMES = ["Last 30 days", "This Quarter", "Year to Date"];

export function PerformanceMetrics({
  timeframe,
  onTimeframeChange,
  trend,
  resolution,
  caseCount,
  resolvedCount,
  onTrackCount,
  atRiskCount,
  overdueCount,
}: {
  timeframe: string;
  onTimeframeChange: (value: string) => void;
  trend: TrendPoint[];
  resolution: ResolutionMetrics;
  caseCount: number;
  resolvedCount: number;
  onTrackCount: number;
  atRiskCount: number;
  overdueCount: number;
}) {
  const points = trend.length > 0 ? trend : fallbackTrend(caseCount, resolvedCount);
  const basis = caseCount || 1;
  const resolvedPct = Math.round((resolvedCount / basis) * 100);
  const onTrackPct = Math.round((onTrackCount / basis) * 100);
  const atRiskPct = Math.round((atRiskCount / basis) * 100);
  const overduePct = Math.round((overdueCount / basis) * 100);
  const improved = resolution.change_pct <= 0;
  const changeLabel = `${Math.abs(Math.round(resolution.change_pct))}%`;
  const avgDays = Number.isFinite(resolution.avg_days)
    ? Number.isInteger(resolution.avg_days)
      ? String(resolution.avg_days)
      : resolution.avg_days.toFixed(1)
    : "0";

  return (
    <Panel className="mb-6 p-6">
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-lg font-extrabold tracking-tight text-slate-950">
          Performance Metrics <span className="text-xs font-medium text-slate-500">(Account Cases)</span>
        </h2>
        <label className="inline-flex items-center gap-2 text-slate-500">
          <Calendar className="h-3.5 w-3.5" />
          <select
            value={timeframe}
            onChange={(event) => onTimeframeChange(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
          >
            {TIMEFRAMES.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid items-stretch gap-5 xl:grid-cols-[1.35fr_1.25fr_0.95fr]">
        <div className="rounded-lg border border-slate-100 bg-[#fcfcfd] p-5">
          <h3 className="text-[13px] font-bold text-slate-800">Case Resolution Trend</h3>
          <div className="mt-1 mb-3 flex gap-4 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Created
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#0f766e]" /> Resolved
            </span>
          </div>
          <TrendChart points={points} />
        </div>

        <div className="flex flex-col rounded-lg border border-slate-100 bg-[#fcfcfd] p-5">
          <h3 className="text-[13px] font-bold text-slate-800">Case Status Breakdown</h3>
          <div className="flex flex-1 items-center justify-center gap-6 py-3">
            <Donut
              total={caseCount}
              segments={[
                { color: "#10b981", value: resolvedCount },
                { color: "#3b82f6", value: onTrackCount },
                { color: "#f59e0b", value: atRiskCount },
                { color: "#ef4444", value: overdueCount },
              ]}
            />
            <ul className="space-y-1.5 text-[11px] text-slate-700">
              <Legend color="#10b981" label="Resolved" count={resolvedCount} pct={resolvedPct} />
              <Legend color="#3b82f6" label="On Track" count={onTrackCount} pct={onTrackPct} />
              <Legend color="#f59e0b" label="At Risk" count={atRiskCount} pct={atRiskPct} />
              <Legend color="#ef4444" label="Overdue" count={overdueCount} pct={overduePct} />
            </ul>
          </div>
          <p className="text-center text-[10px] font-medium text-slate-400">Live dynamic database synchronization</p>
        </div>

        <div className="flex flex-col gap-2.5">
          <MetricCard
            icon={<Clock className="h-3.5 w-3.5" />}
            iconClass="bg-blue-50 text-blue-600"
            label="Avg Resolution"
            value={`${avgDays} days`}
            aside={
              <div className="text-right">
                <div className={`text-[11px] font-bold ${improved ? "text-green-600" : "text-red-600"}`}>
                  {improved ? "↓" : "↑"} {changeLabel}
                </div>
                <div className="text-[8px] text-slate-400">{resolution.timeframe}</div>
              </div>
            }
          />
          <MetricCard
            icon={<Users className="h-3.5 w-3.5" />}
            iconClass="bg-purple-100 text-purple-600"
            label="On Track"
            value={`${onTrackCount} cases`}
            aside={
              <div className="text-right">
                <div className="text-[13px] font-bold text-green-600">{onTrackPct}%</div>
                <div className="text-[8px] text-slate-400">on track</div>
              </div>
            }
          />
          <MetricCard
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            iconClass="bg-orange-50 text-orange-600"
            label="At Risk"
            value={`${atRiskCount} cases`}
            aside={
              <div className="text-right">
                <div className="text-[13px] font-bold text-red-600">{atRiskPct}%</div>
                <div className="text-[8px] text-slate-400">need attention</div>
              </div>
            }
          />
        </div>
      </div>
    </Panel>
  );
}

function TrendChart({ points }: { points: TrendPoint[] }) {
  const max = Math.max(10, ...points.map((point) => Math.max(point.created, point.resolved)));
  return (
    <div>
      <div className="relative h-[128px] border-b border-slate-200">
        {points.map((point, index) => {
          const left =
            points.length === 1
              ? "50%"
              : `calc(10px + (100% - 20px) * ${index / (points.length - 1)})`;
          return (
            <div key={`${point.date}-${index}`} className="absolute top-0 bottom-0" style={{ left }}>
              <span
                title={`${point.date} — Created: ${point.created}`}
                className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-slate-400 shadow-[0_0_0_2px_#fcfcfd]"
                style={{ bottom: `${(point.created / max) * 100}%` }}
              />
              <span
                title={`${point.date} — Resolved: ${point.resolved}`}
                className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-[#0f766e] shadow-[0_0_0_2px_#fcfcfd]"
                style={{ bottom: `${(point.resolved / max) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-semibold text-slate-400">
        {points.map((point, index) => (
          <span key={`${point.date}-${index}`}>{point.date}</span>
        ))}
      </div>
    </div>
  );
}

function Donut({ total, segments }: { total: number; segments: { color: string; value: number }[] }) {
  const sum = segments.reduce((totalValue, segment) => totalValue + segment.value, 0) || 1;
  let cursor = 0;
  const stops = segments
    .map((segment) => {
      const start = (cursor / sum) * 100;
      cursor += segment.value;
      const end = (cursor / sum) * 100;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <div
      className="relative grid h-[104px] w-[104px] shrink-0 place-items-center rounded-full shadow-[0_2px_4px_rgba(15,23,42,0.08)]"
      style={{ background: `conic-gradient(${stops})` }}
      role="img"
      aria-label={`${total} total cases`}
    >
      <div className="grid h-[72px] w-[72px] place-items-center rounded-full bg-white shadow-[inset_0_1px_2px_rgba(15,23,42,0.05)]">
        <div className="text-center leading-none">
          <div className="text-[22px] font-extrabold text-slate-950">{total}</div>
          <div className="mt-1 text-[8px] font-bold tracking-wide text-slate-500">TOTAL</div>
        </div>
      </div>
    </div>
  );
}

function Legend({ color, label, count, pct }: { color: string; label: string; count: number; pct: number }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      <span>
        {label}: <strong>{count}</strong> ({pct}%)
      </span>
    </li>
  );
}

function MetricCard({
  icon,
  iconClass,
  label,
  value,
  aside,
}: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  aside: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-between rounded-lg border border-slate-100 bg-[#fcfcfd] px-4 py-3">
      <div className="flex items-center gap-2.5">
        <div className={`grid h-7 w-7 place-items-center rounded-full ${iconClass}`}>{icon}</div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</div>
          <div className="text-[15px] font-extrabold text-slate-950">{value}</div>
        </div>
      </div>
      {aside}
    </div>
  );
}
