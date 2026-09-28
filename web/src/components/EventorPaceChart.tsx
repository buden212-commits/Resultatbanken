"use client";

import { useId, useState } from "react";

import type { EventorPacePoint } from "@/lib/eventor-person-stats";
import { formatCourseLengthKm, formatKmPace } from "@/lib/eventor-person-stats";

function formatShortDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)}`;
}

function formatAxisDate(date: string, showYear: boolean): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "–";
  const [y, m, d] = date.split("-");
  return showYear ? `${Number(d)}/${Number(m)} ${y}` : `${Number(d)}/${Number(m)}`;
}

export function EventorPaceChart({ points }: { points: EventorPacePoint[] }) {
  const gradientId = useId();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <p className="text-sm text-slate-500">Inga kilometertider för vald period.</p>
    );
  }

  const width = 640;
  const height = 220;
  const pad = { top: 16, right: 16, bottom: 36, left: 44 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const values = points.map((p) => p.kilometreTimeSeconds);
  const minRaw = Math.min(...values);
  const maxRaw = Math.max(...values);
  const padY = Math.max(15, Math.round((maxRaw - minRaw) * 0.15) || 30);
  const yMin = Math.max(0, minRaw - padY);
  const yMax = maxRaw + padY;
  const yRange = Math.max(1, yMax - yMin);

  const multiYear = new Set(points.map((p) => p.date.slice(0, 4))).size > 1;

  const xAt = (index: number) =>
    points.length === 1
      ? pad.left + plotW / 2
      : pad.left + (index / (points.length - 1)) * plotW;
  const yAt = (seconds: number) => pad.top + ((yMax - seconds) / yRange) * plotH;

  const linePath = points
    .map((point, index) => {
      const x = xAt(index);
      const y = yAt(point.kilometreTimeSeconds);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L${xAt(points.length - 1).toFixed(1)} ${(pad.top + plotH).toFixed(1)} L${xAt(0).toFixed(1)} ${(pad.top + plotH).toFixed(1)} Z`
      : "";

  const yTicks = [yMin, (yMin + yMax) / 2, yMax];
  const active = activeIndex !== null ? points[activeIndex] : null;

  const labelIndexes =
    points.length <= 6
      ? points.map((_, i) => i)
      : [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-auto w-full"
          role="img"
          aria-label="Kilometertid över tid"
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#005daa" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#005daa" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yTicks.map((tick) => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line
                  x1={pad.left}
                  x2={pad.left + plotW}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400"
                  fontSize="10"
                >
                  {formatKmPace(Math.round(tick))}
                </text>
              </g>
            );
          })}

          {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          <path
            d={linePath}
            fill="none"
            stroke="#005daa"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {points.map((point, index) => {
            const x = xAt(index);
            const y = yAt(point.kilometreTimeSeconds);
            const isActive = activeIndex === index;
            return (
              <g key={`${point.eventId}-${point.date}-${index}`}>
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 6 : 4.5}
                  fill={isActive ? "#004d8f" : "#005daa"}
                  stroke="#fff"
                  strokeWidth="2"
                  className="pointer-events-none"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={14}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  tabIndex={0}
                  role="button"
                  aria-label={`${point.eventName}, ${point.kilometreTime}/km`}
                />
              </g>
            );
          })}

          {labelIndexes.map((index) => {
            const point = points[index];
            return (
              <text
                key={`label-${index}`}
                x={xAt(index)}
                y={height - 10}
                textAnchor="middle"
                className="fill-slate-400"
                fontSize="10"
              >
                {formatAxisDate(point.date, multiYear)}
              </text>
            );
          })}
        </svg>

        {active ? (
          <div className="pointer-events-none absolute left-1/2 top-2 z-10 w-[min(100%,16rem)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-md shadow-slate-200/80 backdrop-blur-sm sm:text-sm">
            <p className="font-semibold text-slate-900">{active.eventName}</p>
            <p className="mt-0.5 text-slate-500">
              {formatShortDate(active.date)}
              {active.className ? ` · ${active.className}` : ""}
            </p>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 tabular-nums text-slate-700">
              <dt className="text-slate-400">Km-tid</dt>
              <dd className="font-medium">{active.kilometreTime}/km</dd>
              <dt className="text-slate-400">Tid</dt>
              <dd>{active.time ?? "–"}</dd>
              <dt className="text-slate-400">Längd</dt>
              <dd>{formatCourseLengthKm(active.lengthKm)}</dd>
            </dl>
          </div>
        ) : null}
      </div>

      <p className="text-xs text-slate-500">
        Visar {points.length.toLocaleString("sv-SE")} starter med km-tid. Hovra en punkt för tid och
        beräknad banlängd.
      </p>
    </div>
  );
}
