"use client";

import { useEffect, useRef } from "react";

const COLORS = {
  primary: "#1e40af",
  primaryLight: "#3b82f6",
  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  purple: "#8b5cf6",
  cyan: "#06b6d4",
  text: "#6b7280",
  border: "#e5e7eb",
  surface: "#f9fafb",
};

interface BarChartProps {
  data: Array<{ label: string; value1: number; value2?: number; value3?: number }>;
  labels: [string, string?, string?];
  colors?: [string, string?, string?];
  height?: number;
  formatValue?: (n: number) => string;
}

export function BarChart({
  data,
  labels,
  colors = [COLORS.success, COLORS.danger, COLORS.purple],
  height = 220,
  formatValue = (n) => `₹${(n / 1000).toFixed(0)}K`,
}: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    // Find max value
    const allValues = data.flatMap((d) => [d.value1, d.value2 || 0, d.value3 || 0]);
    const maxVal = Math.max(...allValues, 1);
    const niceMax = Math.ceil(maxVal / 10000) * 10000;

    // Draw grid lines
    const gridLines = 5;
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.font = "11px Satoshi, sans-serif";
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = "right";

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      const val = niceMax - (niceMax / gridLines) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillText(formatValue(val), padding.left - 8, y + 4);
    }

    // Draw bars
    const seriesCount = labels.filter(Boolean).length;
    const groupW = chartW / data.length;
    const barW = Math.min(groupW * 0.6 / seriesCount, 30);
    const gap = (groupW - barW * seriesCount) / 2;

    data.forEach((d, i) => {
      const x0 = padding.left + groupW * i + gap;
      const values = [d.value1, d.value2, d.value3].slice(0, seriesCount);

      values.forEach((val, si) => {
        if (val === undefined || val === null) return;
        const barH = (val / niceMax) * chartH;
        const x = x0 + barW * si;
        const y = padding.top + chartH - barH;

        // Rounded top corners
        const radius = 3;
        ctx.fillStyle = colors[si] || COLORS.primary;
        ctx.beginPath();
        ctx.moveTo(x, y + radius);
        ctx.arcTo(x, y, x + barW, y, radius);
        ctx.arcTo(x + barW, y, x + barW, y + barH, radius);
        ctx.lineTo(x + barW, padding.top + chartH);
        ctx.lineTo(x, padding.top + chartH);
        ctx.closePath();
        ctx.fill();
      });

      // X labels
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "center";
      ctx.font = "11px Satoshi, sans-serif";
      ctx.fillText(d.label, padding.left + groupW * i + groupW / 2, h - 15);
    });

    // Legend
    const legendY = h - 5;
    let legendX = padding.left;
    labels.forEach((label, i) => {
      if (!label) return;
      ctx.fillStyle = colors[i] || COLORS.primary;
      ctx.fillRect(legendX, legendY - 8, 10, 10);
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "left";
      ctx.font = "10px Satoshi, sans-serif";
      ctx.fillText(label, legendX + 14, legendY);
      legendX += ctx.measureText(label).width + 30;
    });
  }, [data, labels, colors, height, formatValue]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: `${height}px` }}
      className="block"
    />
  );
}

interface DonutChartProps {
  data: Array<{ label: string; value: number; color: string }>;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function DonutChart({
  data,
  size = 180,
  centerLabel,
  centerValue,
}: DonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const outerR = size / 2 - 10;
    const innerR = outerR * 0.65;
    const total = data.reduce((s, d) => s + d.value, 0);

    ctx.clearRect(0, 0, size, size);

    if (total === 0) {
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = outerR - innerR;
      ctx.beginPath();
      ctx.arc(cx, cy, (outerR + innerR) / 2, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      let startAngle = -Math.PI / 2;
      data.forEach((d) => {
        const sliceAngle = (d.value / total) * Math.PI * 2;
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(startAngle) * innerR, cy + Math.sin(startAngle) * innerR);
        ctx.arc(cx, cy, outerR, startAngle, startAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, startAngle + sliceAngle, startAngle, true);
        ctx.closePath();
        ctx.fill();
        startAngle += sliceAngle;
      });
    }

    // Center text
    if (centerValue) {
      ctx.fillStyle = "#111827";
      ctx.font = "bold 18px Satoshi, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(centerValue, cx, cy - 6);
    }
    if (centerLabel) {
      ctx.fillStyle = COLORS.text;
      ctx.font = "11px Satoshi, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(centerLabel, cx, cy + 14);
    }
  }, [data, size, centerLabel, centerValue]);

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        style={{ width: `${size}px`, height: `${size}px` }}
      />
      <div className="flex flex-wrap justify-center gap-3">
        {data.map((d) => (
          <div key={d.label} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-xs text-text-secondary">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface LineChartProps {
  data: Array<{ label: string; value: number }>;
  color?: string;
  height?: number;
  formatValue?: (n: number) => string;
  showArea?: boolean;
}

export function LineChart({
  data,
  color = COLORS.primary,
  height = 180,
  formatValue = (n) => `${n}%`,
  showArea = true,
}: LineChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data.length) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = { top: 20, right: 20, bottom: 35, left: 45 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const maxVal = Math.max(...data.map((d) => d.value), 1);
    const niceMax = Math.ceil(maxVal / 10) * 10;

    // Grid
    const gridLines = 4;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartH / gridLines) * i;
      const val = niceMax - (niceMax / gridLines) * i;
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "right";
      ctx.font = "11px Satoshi, sans-serif";
      ctx.fillText(formatValue(val), padding.left - 8, y + 4);
    }

    // Points
    const points = data.map((d, i) => ({
      x: padding.left + (chartW / (data.length - 1 || 1)) * i,
      y: padding.top + chartH - (d.value / niceMax) * chartH,
    }));

    // Area fill
    if (showArea) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, padding.top + chartH);
      points.forEach((p) => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, padding.top + chartH);
      ctx.closePath();
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, color + "30");
      gradient.addColorStop(1, color + "05");
      ctx.fillStyle = gradient;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    points.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();

    // Dots
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    // X labels
    data.forEach((d, i) => {
      ctx.fillStyle = COLORS.text;
      ctx.textAlign = "center";
      ctx.font = "11px Satoshi, sans-serif";
      ctx.fillText(d.label, points[i].x, h - 12);
    });
  }, [data, color, height, formatValue, showArea]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: `${height}px` }}
      className="block"
    />
  );
}

interface GaugeChartProps {
  value: number; // 0-100
  size?: number;
  label?: string;
}

export function GaugeChart({ value, size = 140, label }: GaugeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = (size * 0.65) * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size * 0.55;
    const r = size * 0.4;
    const lineWidth = 12;

    ctx.clearRect(0, 0, size, size * 0.65);

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, 0);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Value arc
    const angle = Math.PI + (value / 100) * Math.PI;
    const color = value >= 80 ? COLORS.success : value >= 50 ? COLORS.warning : COLORS.danger;
    ctx.beginPath();
    ctx.arc(cx, cy, r, Math.PI, angle);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.stroke();

    // Value text
    ctx.fillStyle = "#111827";
    ctx.font = `bold ${size * 0.16}px Satoshi, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${value}%`, cx, cy - 5);

    if (label) {
      ctx.fillStyle = COLORS.text;
      ctx.font = `${size * 0.08}px Satoshi, sans-serif`;
      ctx.fillText(label, cx, cy + size * 0.12);
    }
  }, [value, size, label]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: `${size}px`, height: `${size * 0.65}px` }}
    />
  );
}
