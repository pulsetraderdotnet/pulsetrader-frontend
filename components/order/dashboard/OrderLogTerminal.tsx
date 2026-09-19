"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    FiSearch,
    FiX,
    FiFilter,
    FiRefreshCw,
    FiCopy,
    FiChevronDown,
    FiTerminal,
    FiDownload,
    FiSun,
    FiMoon,
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";

import type { OrderType } from "@/type/order";
import { formatCustomizeTime, safeFormatNumber } from "@/utility/handy";
import { displayNumber } from "@/utility/displayPrice";
import { PRECISION_DECIMALS } from "@/constants/common/utils";

// ─── Types ──────────────────────────────────────────────────────────
type FlattenedLog = {
    logId: string;
    orderId: string;
    orderName: string;
    orderSymbol: string;
    orderCategory: "spot" | "perpetual";
    orderMode?: string;
    isLong?: boolean;
    at: number;
    message: string;
    priceUsd?: string;
    pnlUsd?: string;
    weightScore?: number;
};

type TimeFilter = "all" | "1h" | "6h" | "24h" | "7d";
type CategoryFilter = "all" | "spot" | "perpetual";
type ModeFilter = "all" | "Live" | "Demo" | "Testnet";
type LogLevel = "ERROR" | "WARN" | "OPEN" | "CLOSE" | "TRAIL" | "WEIGHT" | "INFO";

// ─── Level styling (light + dark) ──────────────────────────────────
const LEVEL_STYLES: Record<
    LogLevel,
    { tag: string; text: string; bg: string; border: string; dot: string }
> = {
    ERROR: {
        tag: "text-red-700 dark:text-red-300",
        text: "text-red-700 dark:text-red-300",
        bg: "bg-red-50 dark:bg-red-950/40",
        border: "border-red-200 dark:border-red-900/50",
        dot: "bg-red-500",
    },
    WARN: {
        tag: "text-amber-700 dark:text-amber-300",
        text: "text-amber-700 dark:text-amber-300",
        bg: "bg-amber-50 dark:bg-amber-950/30",
        border: "border-amber-200 dark:border-amber-900/50",
        dot: "bg-amber-500",
    },
    OPEN: {
        tag: "text-emerald-700 dark:text-emerald-300",
        text: "text-emerald-700 dark:text-emerald-300",
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        border: "border-emerald-200 dark:border-emerald-900/50",
        dot: "bg-emerald-500",
    },
    CLOSE: {
        tag: "text-orange-700 dark:text-orange-300",
        text: "text-orange-700 dark:text-orange-300",
        bg: "bg-orange-50 dark:bg-orange-950/30",
        border: "border-orange-200 dark:border-orange-900/50",
        dot: "bg-orange-500",
    },
    TRAIL: {
        tag: "text-purple-700 dark:text-purple-300",
        text: "text-purple-700 dark:text-purple-300",
        bg: "bg-purple-50 dark:bg-purple-950/30",
        border: "border-purple-200 dark:border-purple-900/50",
        dot: "bg-purple-500",
    },
    WEIGHT: {
        tag: "text-blue-700 dark:text-blue-300",
        text: "text-blue-700 dark:text-blue-300",
        bg: "bg-blue-50 dark:bg-blue-950/30",
        border: "border-blue-200 dark:border-blue-900/50",
        dot: "bg-blue-500",
    },
    INFO: {
        tag: "text-gray-600 dark:text-gray-400",
        text: "text-gray-800 dark:text-gray-200",
        bg: "bg-white dark:bg-transparent",
        border: "border-transparent",
        dot: "bg-gray-400",
    },
};

// ─── Determine log level from message ──────────────────────────────
function getLogLevel(message: string, pnlUsd?: string): LogLevel {
    const lower = message?.toLowerCase() || "";
    if (lower.includes("fail") || lower.includes("error") || lower.includes("revert"))
        return "ERROR";
    if (lower.includes("warn") || lower.includes("insufficient")) return "WARN";
    if (lower.includes("trailing")) return "TRAIL";
    if (lower.includes("close") || lower.includes("exit") || lower.includes("closed"))
        return "CLOSE";
    if (lower.includes("open") || lower.includes("position opened")) return "OPEN";
    if (lower.includes("accumulated")) return "OPEN";
    if (lower.includes("weight")) return "WEIGHT";
    if (lower.includes("pnl")) return "INFO";
    if (pnlUsd && pnlUsd !== "0") return "INFO";
    return "INFO";
}

// ─── Format timestamp as [2026-09-06T05:01:19.263Z] ───────────────
function formatFullTimestamp(ms: number): string {
    try {
        return new Date(ms).toISOString();
    } catch {
        return "—";
    }
}

// ─── Short order ID ───────────────────────────────────────────────
function shortOrderId(id: string): string {
    if (!id) return "----------";
    return id.slice(-8);
}

// ─── Main Component ────────────────────────────────────────────────
export default function OrderLogTerminal({ orders }: { orders: OrderType[] }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
    const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
    const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
    const [showFilters, setShowFilters] = useState(false);
    const [autoScroll, setAutoScroll] = useState(true);
    const [visibleCount, setVisibleCount] = useState(200);
    const [wrapLines, setWrapLines] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // ─── Flatten all execution logs ─────────────────────────────────
    const allLogs: FlattenedLog[] = useMemo(() => {
        if (!orders || orders.length === 0) return [];
        const flattened: FlattenedLog[] = [];
        for (const order of orders) {
            const logs = order?.executionDetails?.logs || [];
            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                flattened.push({
                    logId: `${order._id}-${i}-${log.at}`,
                    orderId: order._id || "",
                    orderName: order.name || "Untitled",
                    orderSymbol: order.orderAsset?.orderToken?.symbol || "UNK",
                    orderCategory: order.category as "spot" | "perpetual",
                    orderMode: order.orderMode,
                    isLong: order.perp?.isLong,
                    at: log.at || 0,
                    message: log.message || "—",
                    priceUsd: log.priceUsd,
                    pnlUsd: log.pnlUsd,
                    weightScore: log.weightScore,
                });
            }
        }
        return flattened.sort((a, b) => b.at - a.at);
    }, [orders]);

    // ─── Apply filters ──────────────────────────────────────────────
    const filteredLogs = useMemo(() => {
        const now = Date.now();
        const timeRanges: Record<TimeFilter, number> = {
            all: Infinity,
            "1h": 60 * 60 * 1000,
            "6h": 6 * 60 * 60 * 1000,
            "24h": 24 * 60 * 60 * 1000,
            "7d": 7 * 24 * 60 * 60 * 1000,
        };
        const cutoff = timeRanges[timeFilter] === Infinity ? 0 : now - timeRanges[timeFilter];
        let result = allLogs;
        if (cutoff > 0) result = result.filter((l) => l.at >= cutoff);
        if (categoryFilter !== "all") result = result.filter((l) => l.orderCategory === categoryFilter);
        if (modeFilter !== "all") result = result.filter((l) => l.orderMode === modeFilter);
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase().trim();
            result = result.filter(
                (l) =>
                    l.message?.toLowerCase().includes(term) ||
                    l.orderName?.toLowerCase().includes(term) ||
                    l.orderSymbol?.toLowerCase().includes(term) ||
                    l.orderId?.toLowerCase().includes(term) ||
                    l.priceUsd?.includes(term) ||
                    l.pnlUsd?.includes(term)
            );
        }
        return result;
    }, [allLogs, searchTerm, timeFilter, categoryFilter, modeFilter]);

    // ─── Auto-scroll ────────────────────────────────────────────────
    useEffect(() => {
        if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = 0;
    }, [filteredLogs.length, autoScroll]);

    useEffect(() => {
        setVisibleCount(200);
    }, [searchTerm, timeFilter, categoryFilter, modeFilter]);

    // ─── Handlers ───────────────────────────────────────────────────
    const handleCopyAll = useCallback(() => {
        const text = filteredLogs
            .slice(0, visibleCount)
            .map(
                (l) =>
                    `[${formatFullTimestamp(l.at)}] [${l.orderSymbol}${l.priceUsd ? `:${safeFormatNumber(l.priceUsd, PRECISION_DECIMALS, 6)}` : ""
                    }] [${shortOrderId(l.orderId)}] ${l.message}${l.pnlUsd && l.pnlUsd !== "0"
                        ? ` [pnl=${safeFormatNumber(l.pnlUsd, PRECISION_DECIMALS, 6)}]`
                        : ""
                    }${l.weightScore !== undefined ? ` [w=${l.weightScore}]` : ""}`
            )
            .join("\n");
        navigator.clipboard.writeText(text);
        toast.success(`Copied ${Math.min(visibleCount, filteredLogs.length)} log entries`);
    }, [filteredLogs, visibleCount]);

    const handleDownload = useCallback(() => {
        const text = filteredLogs
            .map(
                (l) =>
                    `[${formatFullTimestamp(l.at)}] [${l.orderSymbol}${l.priceUsd ? `:${safeFormatNumber(l.priceUsd, PRECISION_DECIMALS, 6)}` : ""
                    }] [${shortOrderId(l.orderId)}] ${l.message}${l.pnlUsd && l.pnlUsd !== "0"
                        ? ` [pnl=${safeFormatNumber(l.pnlUsd, PRECISION_DECIMALS, 6)}]`
                        : ""
                    }${l.weightScore !== undefined ? ` [w=${l.weightScore}]` : ""}`
            )
            .join("\n");
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pulsetrader-logs-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Log file downloaded");
    }, [filteredLogs]);

    const clearFilters = useCallback(() => {
        setSearchTerm("");
        setTimeFilter("all");
        setCategoryFilter("all");
        setModeFilter("all");
    }, []);

    const hasActiveFilters =
        searchTerm.trim() !== "" ||
        timeFilter !== "all" ||
        categoryFilter !== "all" ||
        modeFilter !== "all";

    // ─── Render ─────────────────────────────────────────────────────
    return (
        <div className="w-full   bg-white dark:bg-[#0a0c10] overflow-hidden shadow-sm">
            {/* ─── Header bar ─── */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white dark:bg-[#0d1014] border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-mono text-gray-600 dark:text-gray-400 uppercase tracking-widest">
                        <FiTerminal className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                        <span>Execution Log Terminal</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="text-emerald-600 dark:text-emerald-400">
                        ● {filteredLogs.length} entries
                    </span>
                    {hasActiveFilters && (
                        <span className="text-gray-500 dark:text-gray-600 hidden sm:inline">
                            (filtered)
                        </span>
                    )}
                </div>
            </div>

            {/* ─── Toolbar ─── */}
            <div className="px-3 sm:px-4 py-3 bg-gray-50/60 dark:bg-[#0b0e12]/60 border-b border-gray-200 dark:border-gray-800">
                <div className="flex flex-wrap items-center gap-2">
                    {/* Search */}
                    <div className="relative flex-1 min-w-[200px]">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 w-3.5 h-3.5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search logs by message, symbol, order name, price, or PnL..."
                            className="w-full rounded-md border border-gray-300 dark:border-gray-700/60 bg-white dark:bg-black/40 pl-9 pr-8 py-2 text-xs text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 outline-none focus:border-emerald-500/60 transition-colors font-mono"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300"
                            >
                                <FiX className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filter toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${showFilters || hasActiveFilters
                            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                            }`}
                    >
                        <FiFilter className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Filters</span>
                        {hasActiveFilters && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        )}
                    </button>

                    {/* Auto-scroll */}
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${autoScroll
                            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                            }`}
                        title="Auto-scroll to latest"
                    >
                        <FiRefreshCw
                            className={`w-3.5 h-3.5 ${autoScroll ? "animate-spin" : ""}`}
                            style={{ animationDuration: "3s" }}
                        />
                        <span className="hidden sm:inline">Auto</span>
                    </button>

                    {/* Wrap lines */}
                    <button
                        onClick={() => setWrapLines(!wrapLines)}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${wrapLines
                            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                            }`}
                        title="Wrap long lines"
                    >
                        <span className="hidden sm:inline">Wrap</span>
                        <span className="sm:hidden">↩</span>
                    </button>

                    {/* Copy */}
                    <button
                        onClick={handleCopyAll}
                        disabled={filteredLogs.length === 0}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Copy visible logs"
                    >
                        <FiCopy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                    </button>

                    {/* Download */}
                    <button
                        onClick={handleDownload}
                        disabled={filteredLogs.length === 0}
                        className="flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Download logs"
                    >
                        <FiDownload className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Export</span>
                    </button>
                </div>

                {/* ─── Filter panel ─── */}
                <AnimatePresence>
                    {showFilters && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-1.5">
                                        Time Range
                                    </label>
                                    <div className="flex gap-1 flex-wrap">
                                        {(["all", "1h", "6h", "24h", "7d"] as TimeFilter[]).map((t) => (
                                            <button
                                                key={t}
                                                onClick={() => setTimeFilter(t)}
                                                className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${timeFilter === t
                                                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40"
                                                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700/60 hover:text-gray-700 dark:hover:text-gray-300"
                                                    }`}
                                            >
                                                {t === "all" ? "ALL" : t.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-1.5">
                                        Category
                                    </label>
                                    <div className="flex gap-1 flex-wrap">
                                        {(["all", "spot", "perpetual"] as CategoryFilter[]).map((c) => (
                                            <button
                                                key={c}
                                                onClick={() => setCategoryFilter(c)}
                                                className={`px-2.5 py-1 text-[10px] font-mono rounded capitalize transition-colors ${categoryFilter === c
                                                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40"
                                                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700/60 hover:text-gray-700 dark:hover:text-gray-300"
                                                    }`}
                                            >
                                                {c === "all" ? "ALL" : c.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-mono uppercase tracking-widest text-gray-500 dark:text-gray-500 mb-1.5">
                                        Order Mode
                                    </label>
                                    <div className="flex gap-1 flex-wrap">
                                        {(["all", "Live", "Demo", "Testnet"] as ModeFilter[]).map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => setModeFilter(m)}
                                                className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${modeFilter === m
                                                    ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/40"
                                                    : "bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700/60 hover:text-gray-700 dark:hover:text-gray-300"
                                                    }`}
                                            >
                                                {m === "all" ? "ALL" : m.toUpperCase()}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {hasActiveFilters && (
                                <div className="mt-3 flex justify-end">
                                    <button
                                        onClick={clearFilters}
                                        className="flex items-center gap-1 text-[10px] font-mono text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors uppercase tracking-widest"
                                    >
                                        <FiX className="w-3 h-3" /> Clear all filters
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* ─── Log feed ─── */}
            <div
                ref={scrollRef}
                className="max-h-[600px] overflow-y-auto overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-700 scrollbar-track-transparent bg-white dark:bg-[#0a0c10]"
            >
                {filteredLogs.length === 0 ? (
                    <div className="py-20 text-center">
                        <FiTerminal className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-700 mb-3" />
                        <p className="text-sm text-gray-500 dark:text-gray-500 font-mono">
                            {allLogs.length === 0
                                ? "No execution logs available yet..."
                                : "No logs match your filters."}
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-mono"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {filteredLogs.slice(0, visibleCount).map((log, idx) => {
                            const level = getLogLevel(log.message, log.pnlUsd);
                            const style = LEVEL_STYLES[level];
                            const isPerp = log.orderCategory === "perpetual";
                            const priceStr =
                                log.priceUsd && log.priceUsd !== "0"
                                    ? safeFormatNumber(log.priceUsd, PRECISION_DECIMALS, 6)
                                    : null;
                            const pnlStr =
                                log.pnlUsd && log.pnlUsd !== "0"
                                    ? safeFormatNumber(log.pnlUsd, PRECISION_DECIMALS, 6)
                                    : null;
                            const isPosPnl = pnlStr ? BigInt(log.pnlUsd!) > BigInt(0) : false;
                            const isNegPnl = pnlStr ? BigInt(log.pnlUsd!) < BigInt(0) : false;

                            return (
                                <motion.div
                                    key={log.logId}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.12, delay: Math.min(idx * 0.003, 0.2) }}
                                    className={`group flex items-start gap-3 px-4 py-1.5 border-b border-gray-100 dark:border-gray-900/70 last:border-0 hover:bg-gray-50 dark:hover:bg-white/[0.02] font-mono text-[11px] leading-5 transition-colors ${wrapLines ? "" : "whitespace-nowrap"
                                        }`}
                                >
                                    {/* Level indicator dot */}
                                    <span
                                        className={`mt-[7px] w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`}
                                    />

                                    {/* [timestamp] */}
                                    <span className="text-gray-400 dark:text-gray-600 select-none shrink-0">
                                        [{formatFullTimestamp(log.at)}]
                                    </span>

                                    {/* [LEVEL] */}
                                    <span
                                        className={`font-bold shrink-0 w-[52px] ${style.tag}`}
                                    >
                                        [{level}]
                                    </span>

                                    {/* [symbol:price] */}
                                    <span className="shrink-0 text-gray-700 dark:text-gray-300">
                                        [
                                        <span className="font-bold text-gray-900 dark:text-white">
                                            {log.orderSymbol}
                                        </span>
                                        {isPerp && log.isLong !== undefined && (
                                            <span
                                                className={
                                                    log.isLong
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-red-600 dark:text-red-400"
                                                }
                                            >
                                                :{log.isLong ? "L" : "S"}
                                            </span>
                                        )}
                                        {priceStr && (
                                            <>
                                                <span className="text-gray-400 dark:text-gray-600">:</span>
                                                <span className="text-gray-700 dark:text-gray-300">
                                                    ${displayNumber(Number(priceStr))}
                                                </span>
                                            </>
                                        )}
                                        ]
                                    </span>

                                    {/* [orderId] */}
                                    <span
                                        className="shrink-0 text-gray-400 dark:text-gray-600"
                                        title={log.orderId}
                                    >
                                        [{shortOrderId(log.orderId)}]
                                    </span>

                                    {/* message */}
                                    <span
                                        className={`flex-1 min-w-0 ${wrapLines ? "break-all" : "truncate"
                                            } ${style.text}`}
                                    >
                                        {log.message}
                                    </span>

                                    {/* [pnl / weight] */}
                                    <span className="shrink-0 flex items-center gap-2 ml-auto">
                                        {pnlStr && (
                                            <span
                                                className={`font-bold ${isPosPnl
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : isNegPnl
                                                        ? "text-red-600 dark:text-red-400"
                                                        : "text-gray-500"
                                                    }`}
                                            >
                                                [{isPosPnl ? "+" : ""}
                                                {displayNumber(Number(pnlStr))}$]
                                            </span>
                                        )}
                                        {log.weightScore !== undefined && log.weightScore !== null && (
                                            <span className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 px-1.5 py-0.5 rounded text-[10px]">
                                                W:{log.weightScore}
                                            </span>
                                        )}
                                        {!pnlStr && log.weightScore === undefined && (
                                            <span className="text-gray-300 dark:text-gray-800">—</span>
                                        )}
                                    </span>
                                </motion.div>
                            );
                        })}

                        {/* Load more */}
                        {filteredLogs.length > visibleCount && (
                            <div className="py-4 text-center border-t border-gray-100 dark:border-gray-900">
                                <button
                                    onClick={() => setVisibleCount((c) => c + 200)}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 dark:border-gray-700/60 bg-white dark:bg-white/5 px-4 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-400 dark:hover:border-emerald-500/40 transition-colors"
                                >
                                    <FiChevronDown className="w-3.5 h-3.5" />
                                    Load {Math.min(200, filteredLogs.length - visibleCount)} more
                                    <span className="text-gray-400 dark:text-gray-600">
                                        ({visibleCount}/{filteredLogs.length})
                                    </span>
                                </button>
                            </div>
                        )}

                        {/* Footer summary */}
                        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-black/30 text-[10px] font-mono text-gray-500 dark:text-gray-600 flex items-center justify-between sticky bottom-0">
                            <span>
                                Showing {Math.min(visibleCount, filteredLogs.length)} of{" "}
                                {filteredLogs.length} entries
                            </span>
                            <span>
                                {hasActiveFilters && "FILTERED · "}
                                {allLogs.length} total logs from {orders.length} orders
                            </span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}