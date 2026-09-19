import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ErrorBar,
  LineChart, Line, Legend, ScatterChart, Scatter, ReferenceLine, Cell,
} from "recharts";
import type { Histogram } from "../lib/api";

const BLUE = "var(--accent-blue)";
const ORANGE = "var(--accent-orange)";
const AQUA = "var(--accent-aqua)";
const GRID = "var(--rule)";
const AXIS = "var(--ink-muted)";

const axisStyle = { fontFamily: "IBM Plex Mono, monospace", fontSize: 11, fill: "var(--ink-muted)" };

export function PgrPlrBar({
  pgr, plr, sePgr, sePlr,
}: { pgr: number; plr: number; sePgr: number; sePlr: number }) {
  const data = [
    { name: "PGR", value: pgr * 100, err: sePgr * 100 * 1.96 },
    { name: "PLR", value: plr * 100, err: sePlr * 100 * 1.96 },
  ];
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" unit="%" tick={axisStyle} stroke={AXIS} />
        <YAxis type="category" dataKey="name" tick={{ ...axisStyle, fontSize: 13 }} stroke={AXIS} width={50} />
        <Tooltip
          formatter={(v: number) => `${v.toFixed(2)}%`}
          contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }}
        />
        <Bar dataKey="value" barSize={34} radius={[0, 3, 3, 0]}>
          {data.map((d, i) => <Cell key={i} fill={i === 0 ? BLUE : ORANGE} />)}
          <ErrorBar dataKey="err" width={6} strokeWidth={1.5} stroke="var(--ink-soft)" direction="x" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function HistPair({ a, b, labelA, labelB }: { a: Histogram; b: Histogram; labelA: string; labelB: string }) {
  const toPoints = (h: Histogram, key: string) =>
    h.counts.map((c, i) => ({ x: ((h.edges[i] + h.edges[i + 1]) / 2) * 100, [key]: c }));
  const pa = toPoints(a, "a");
  const pb = toPoints(b, "b");
  const merged: Record<number, { x: number; a?: number; b?: number }> = {};
  pa.forEach((p) => (merged[p.x] = { ...merged[p.x], x: p.x, a: p.a as number }));
  pb.forEach((p) => (merged[p.x] = { ...merged[p.x], x: p.x, b: p.b as number }));
  const data = Object.values(merged).sort((m, n) => m.x - n.x);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="x" tick={axisStyle} stroke={AXIS} unit="pp" tickFormatter={(v) => v.toFixed(1)} />
        <YAxis tick={axisStyle} stroke={AXIS} />
        <Tooltip contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans" }} />
        <Bar dataKey="a" name={labelA} fill={BLUE} opacity={0.75} />
        <Bar dataKey="b" name={labelB} fill={ORANGE} opacity={0.6} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DispositionOverTime({
  day, pgr, plr,
}: { day: number[]; pgr: (number | null)[]; plr: (number | null)[] }) {
  const data = day.map((d, i) => ({ day: d, pgr: pgr[i] === null ? undefined : (pgr[i] as number) * 100, plr: plr[i] === null ? undefined : (plr[i] as number) * 100 }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={axisStyle} stroke={AXIS} label={{ value: "día de mercado", position: "insideBottom", offset: -4, style: { fontSize: 11, fill: AXIS } }} />
        <YAxis tick={axisStyle} stroke={AXIS} unit="%" width={44} />
        <Tooltip contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans" }} />
        <Line type="monotone" dataKey="pgr" name="PGR acumulado" stroke={BLUE} dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="plr" name="PLR acumulado" stroke={ORANGE} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ValueIndexChart({
  day, valueIndex, marketIndex,
}: { day: number[]; valueIndex: number[]; marketIndex: number[] }) {
  const data = day.map((d, i) => ({
    day: d,
    cuentas: (valueIndex[i] - 1) * 100,
    mercado: (Math.exp(marketIndex[i]) - 1) * 100,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={axisStyle} stroke={AXIS} />
        <YAxis tick={axisStyle} stroke={AXIS} unit="%" width={44} />
        <ReferenceLine y={0} stroke="var(--rule-strong)" />
        <Tooltip contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }} formatter={(v: number) => `${v.toFixed(1)}%`} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans" }} />
        <Line type="monotone" dataKey="cuentas" name="Cuentas (promedio, neto)" stroke={BLUE} dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="mercado" name="Índice de mercado (factor)" stroke={AQUA} dot={false} strokeWidth={1.5} strokeDasharray="4 3" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TurnoverScatter({
  turnover, net, grossMid,
}: { turnover: number[]; net: number[]; grossMid: number[] }) {
  const dataNet = turnover.map((t, i) => ({ x: t, y: net[i] * 100 }));
  const dataGross = turnover.map((t, i) => ({ x: t, y: grossMid[i] * 100 }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} />
        <XAxis type="number" dataKey="x" name="turnover" tick={axisStyle} stroke={AXIS} label={{ value: "turnover anualizado", position: "insideBottom", offset: -4, style: { fontSize: 11, fill: AXIS } }} />
        <YAxis type="number" dataKey="y" name="retorno" unit="%" tick={axisStyle} stroke={AXIS} width={44} />
        <ReferenceLine y={0} stroke="var(--rule-strong)" />
        <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12, fontFamily: "IBM Plex Sans" }} />
        <Scatter name="retorno neto" data={dataNet} fill={BLUE} opacity={0.55} r={3} />
        <Scatter name="retorno bruto (mid, sin fricción)" data={dataGross} fill={ORANGE} opacity={0.55} r={3} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

export function TurnoverOverTime({ day, meanTurnover }: { day: number[]; meanTurnover: (number | null)[] }) {
  const data = day.map((d, i) => ({ day: d, turnover: meanTurnover[i] === null ? undefined : (meanTurnover[i] as number) }));
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="day" tick={axisStyle} stroke={AXIS} />
        <YAxis tick={axisStyle} stroke={AXIS} width={44} />
        <Tooltip contentStyle={{ background: "var(--paper-raised)", border: "1px solid var(--rule)", fontSize: 12 }} />
        <Line type="monotone" dataKey="turnover" name="turnover anualizado promedio" stroke={AQUA} dot={false} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
