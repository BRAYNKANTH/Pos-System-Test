"use client";

import React, { useState } from "react";
import { TrendingUp, PieChart as PieChartIcon, BarChart2, Calendar, Sparkles } from "lucide-react";

interface SalesPoint {
  label: string;
  value: number;
}

interface CategoryPoint {
  name: string;
  value: number;
  color: string;
}

interface VisualAnalyticsChartsProps {
  salesTrend?: SalesPoint[];
  categoryDistribution?: CategoryPoint[];
  cashierPerformance?: SalesPoint[];
}

export function VisualAnalyticsCharts({
  salesTrend = [
    { label: "Mon", value: 14500 },
    { label: "Tue", value: 22400 },
    { label: "Wed", value: 18900 },
    { label: "Thu", value: 31200 },
    { label: "Fri", value: 45800 },
    { label: "Sat", value: 58000 },
    { label: "Sun", value: 39500 },
  ],
  categoryDistribution = [
    { name: "Groceries", value: 45000, color: "#6366f1" },
    { name: "Beverages", value: 28000, color: "#10b981" },
    { name: "Bakery", value: 18000, color: "#f59e0b" },
    { name: "Snacks", value: 12000, color: "#ec4899" },
    { name: "Others", value: 8500, color: "#8b5cf6" },
  ],
  cashierPerformance = [
    { label: "Admin User", value: 68500 },
    { label: "Sarah (Cashier)", value: 42300 },
    { label: "David (Staff)", value: 29800 },
  ],
}: VisualAnalyticsChartsProps) {
  const [activeTab, setActiveTab] = useState<"trend" | "category" | "cashier">("trend");
  const [hoveredTrendPoint, setHoveredTrendPoint] = useState<SalesPoint | null>(null);

  // Math for Line Chart SVG
  const maxTrendVal = Math.max(...salesTrend.map((d) => d.value), 100);
  const chartHeight = 160;
  const chartWidth = 560;

  const pointsString = salesTrend
    .map((pt, i) => {
      const x = (i / (salesTrend.length - 1)) * chartWidth;
      const y = chartHeight - (pt.value / maxTrendVal) * (chartHeight - 20) - 10;
      return `${x},${y}`;
    })
    .join(" ");

  // Donut chart math
  const totalCatValue = categoryDistribution.reduce((sum, c) => sum + c.value, 0);
  let cumulativeAngle = 0;

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-6 print:hidden">
      
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
        <div>
          <h3 className="text-base font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" /> Interactive Visual Analytics
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">Dynamic charts and breakdown of sales trends and category revenues</p>
        </div>

        <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-bold select-none">
          <button
            onClick={() => setActiveTab("trend")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "trend"
                ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" /> Sales Trend
          </button>

          <button
            onClick={() => setActiveTab("category")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "category"
                ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <PieChartIcon className="h-3.5 w-3.5" /> Category Share
          </button>

          <button
            onClick={() => setActiveTab("cashier")}
            className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === "cashier"
                ? "bg-white dark:bg-zinc-950 text-indigo-600 dark:text-indigo-400 shadow-2xs font-extrabold"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5" /> Staff Sales
          </button>
        </div>
      </div>

      {/* CHART CONTENT VIEWS */}
      {activeTab === "trend" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-zinc-500">Weekly Revenue Flow</span>
            <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-sm">
              {hoveredTrendPoint
                ? `${hoveredTrendPoint.label}: Rs ${hoveredTrendPoint.value.toLocaleString()}`
                : `Total: Rs ${salesTrend.reduce((s, p) => s + p.value, 0).toLocaleString()}`}
            </span>
          </div>

          <div className="relative w-full h-44 flex items-center justify-center pt-2">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-full overflow-visible">
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Area polygon */}
              <polygon
                points={`0,${chartHeight} ${pointsString} ${chartWidth},${chartHeight}`}
                fill="url(#trendGradient)"
              />

              {/* Smooth line */}
              <polyline
                fill="none"
                stroke="#4f46e5"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={pointsString}
              />

              {/* Interactive Data Nodes */}
              {salesTrend.map((pt, i) => {
                const x = (i / (salesTrend.length - 1)) * chartWidth;
                const y = chartHeight - (pt.value / maxTrendVal) * (chartHeight - 20) - 10;
                return (
                  <g key={i} className="cursor-pointer group" onMouseEnter={() => setHoveredTrendPoint(pt)}>
                    <circle
                      cx={x}
                      cy={y}
                      r="6"
                      className="fill-indigo-600 stroke-white stroke-2 group-hover:scale-125 transition-transform"
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* X Axis Labels */}
          <div className="flex justify-between text-[11px] font-bold text-zinc-400 px-1 pt-1">
            {salesTrend.map((pt, i) => (
              <span key={i} className={hoveredTrendPoint?.label === pt.label ? "text-indigo-600 dark:text-indigo-400 font-extrabold" : ""}>
                {pt.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {activeTab === "category" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          
          {/* Donut SVG */}
          <div className="relative flex justify-center items-center h-44">
            <svg viewBox="0 0 100 100" className="w-40 h-40 transform -rotate-90">
              {categoryDistribution.map((cat, idx) => {
                const sliceAngle = (cat.value / totalCatValue) * 360;
                const strokeDasharray = `${(sliceAngle / 360) * 283} 283`;
                const strokeDashoffset = -((cumulativeAngle / 360) * 283);
                cumulativeAngle += sliceAngle;

                return (
                  <circle
                    key={idx}
                    cx="50"
                    cy="50"
                    r="45"
                    fill="transparent"
                    stroke={cat.color}
                    strokeWidth="12"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                );
              })}
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-zinc-400 uppercase">Categories</span>
              <span className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100">{categoryDistribution.length}</span>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-2.5 text-xs">
            {categoryDistribution.map((cat, i) => {
              const pct = ((cat.value / totalCatValue) * 100).toFixed(1);
              return (
                <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-zinc-50 dark:bg-zinc-850">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="font-bold text-zinc-700 dark:text-zinc-300">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="font-extrabold text-zinc-900 dark:text-zinc-100">Rs {cat.value.toLocaleString()}</span>
                    <span className="text-[10px] text-zinc-400 font-bold w-10 text-right">{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      )}

      {activeTab === "cashier" && (
        <div className="space-y-3 pt-2">
          {cashierPerformance.map((c, idx) => {
            const maxVal = Math.max(...cashierPerformance.map((item) => item.value), 1);
            const pct = Math.max((c.value / maxVal) * 100, 4);

            return (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                  <span>{c.label}</span>
                  <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400">
                    Rs {c.value.toLocaleString()}
                  </span>
                </div>
                <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-indigo-700 rounded-md transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
