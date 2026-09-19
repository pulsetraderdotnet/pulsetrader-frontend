"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import {
  FiTarget, FiZap, FiShield, FiArrowRight, FiLayers,
  FiActivity, FiTrendingUp, FiCpu, FiLock, FiCheckCircle,
  FiTerminal, FiGlobe, FiBarChart2,
} from "react-icons/fi";
import Link from "next/link";

// ─── Chain Data ─────────────────────────────────────────────
const chains = [
  { name: "Ethereum", color: "from-blue-500 to-indigo-500", top: "12%", left: "8%", delay: 0 },
  { name: "Solana", color: "from-purple-500 to-fuchsia-500", top: "22%", left: "78%", delay: 0.3 },
  { name: "Base", color: "from-blue-400 to-cyan-400", top: "62%", left: "12%", delay: 0.5 },
  { name: "Arbitrum", color: "from-cyan-500 to-blue-600", top: "78%", left: "72%", delay: 0.15 },
  { name: "Polygon", color: "from-purple-600 to-violet-600", top: "42%", left: "88%", delay: 0.4 },
  { name: "BSC", color: "from-yellow-500 to-amber-500", top: "8%", left: "58%", delay: 0.6 },
  { name: "Avalanche", color: "from-red-500 to-rose-500", top: "72%", left: "28%", delay: 0.25 },
];

const stats = [
  { value: "4+", label: "Chains" },
  { value: "<50ms", label: "Latency" },
  { value: "99.9%", label: "Uptime" },
  { value: "0", label: "Custody" },
];

const features = [
  {
    icon: <FiTarget className="w-5 h-5" />,
    color: "text-blue-400",
    glow: "group-hover:shadow-blue-500/20",
    bg: "group-hover:bg-blue-500/10",
    border: "group-hover:border-blue-500/30",
    title: "Strategy Engine",
    desc: "Deploy RSI oversold, EMA crossovers, and grid strategies across 20+ chains with sub-second execution.",
  },
  {
    icon: <FiLayers className="w-5 h-5" />,
    color: "text-cyan-400",
    glow: "group-hover:shadow-cyan-500/20",
    bg: "group-hover:bg-cyan-500/10",
    border: "group-hover:border-cyan-500/30",
    title: "Multi-Chain Hub",
    desc: "One unified terminal for Ethereum, Solana, Base, Arbitrum, and every EVM L2 that matters.",
  },
  {
    icon: <FiZap className="w-5 h-5" />,
    color: "text-yellow-400",
    glow: "group-hover:shadow-yellow-500/20",
    bg: "group-hover:bg-yellow-500/10",
    border: "group-hover:border-yellow-500/30",
    title: "Perps & Spot",
    desc: "High-leverage perpetuals on Hyperliquid & AsterDEX, or deep-liquidity spot swaps — all in one place.",
  },
  {
    icon: <FiShield className="w-5 h-5" />,
    color: "text-emerald-400",
    glow: "group-hover:shadow-emerald-500/20",
    bg: "group-hover:bg-emerald-500/10",
    border: "group-hover:border-emerald-500/30",
    title: "Non-Custodial",
    desc: "You hold the keys. Trade directly from your wallet with zero counterparty risk, ever.",
  },
];

// ─── Main Component ─────────────────────────────────────────
export default function PulseTraderHome() {
  return (
    <div className="min-h-screen bg-[#F8F9FB] dark:bg-[#050608] text-gray-900 dark:text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden relative transition-colors duration-300">

      {/* Background Layers */}
      <BackgroundLayers />

      <main className="relative z-10">
        <HeroSection />
        <StatsStrip />
        <FeatureSection />
        <TerminalMockup />
        <FinalCTA />
      </main>

      <Footer />
    </div>
  );
}

// ─── Background ─────────────────────────────────────────────
function BackgroundLayers() {
  return (
    <>
      {/* Chain cloud */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {chains.map((chain, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
              opacity: [0.08, 0.22, 0.08],
              y: [0, -18, 0],
              scale: 1,
            }}
            transition={{ duration: 6 + i, repeat: Infinity, delay: chain.delay }}
            style={{ top: chain.top, left: chain.left }}
            className="absolute flex items-center gap-2 px-3 py-1.5 rounded-full border border-gray-200/60 dark:border-white/5 bg-white/70 dark:bg-white/[0.03] backdrop-blur-md shadow-sm"
          >
            <div className={`w-1.5 h-1.5 rounded-full bg-gradient-to-r ${chain.color} shadow-lg animate-pulse`} />
            <span className="text-[9px] md:text-[10px] font-mono tracking-[0.15em] text-gray-500 dark:text-slate-500 uppercase">
              {chain.name}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Ambient glows */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-blue-500/8 dark:bg-blue-600/10 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[500px] bg-purple-500/8 dark:bg-purple-600/8 blur-[140px] rounded-full" />
        <div className="absolute top-1/2 left-[-10%] w-[500px] h-[400px] bg-cyan-500/6 dark:bg-cyan-600/6 blur-[140px] rounded-full" />
      </div>

      {/* Grid pattern */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.15] dark:opacity-[0.08]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(100,116,139,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.3) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 0%, black 20%, transparent 70%)",
        }}
      />
    </>
  );
}

// ─── Hero ───────────────────────────────────────────────────
function HeroSection() {
  return (
    <section className="relative container mx-auto px-4 sm:px-6 pt-24 md:pt-32 pb-16 md:pb-24">
      {/* Badge */}
      {/* <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="flex justify-center mb-8"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200/80 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-md shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] sm:text-[11px] font-mono tracking-[0.2em] uppercase text-gray-600 dark:text-slate-400">
            All Systems Operational
          </span>
        </div>
      </motion.div> */}

      {/* Headline */}
      <div className="text-center max-w-5xl mx-auto mb-10">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-[-0.03em] text-gray-900 dark:text-white leading-[1.02] mb-6"
        >
          Trade on the edge
          <br />
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 bg-clip-text text-transparent">
              of every signal.
            </span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
              className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400 rounded-full origin-left opacity-40"
            />
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-base sm:text-lg md:text-xl text-gray-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed"
        >
          A quantitative execution terminal for DeFi. Automate strategies,
          monitor order flow, and execute across 5+ chains — from a single,
          non-custodial interface.
        </motion.p>
      </div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12"
      >
        <Link
          href="/strategy"
          className="group relative inline-flex items-center gap-2 px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-black font-bold rounded-full overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl text-sm sm:text-base"
        >
          <span className="relative z-10 flex items-center gap-2 uppercase tracking-wide">
            Enter Terminal
            <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
          </span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          {/* <span className="relative z-10 flex items-center gap-2 uppercase tracking-wide opacity-0 group-hover:opacity-100 absolute inset-0 justify-center">
            Enter Terminal
            <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </span> */}
        </Link>

        <Link
          href="/docs"
          className="inline-flex items-center gap-2 px-8 py-4 border border-gray-300 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] backdrop-blur-md text-gray-700 dark:text-slate-300 font-semibold rounded-full hover:border-gray-400 dark:hover:border-white/20 transition-all text-sm sm:text-base"
        >
          <FiTerminal className="w-4 h-4" />
          Read Docs
        </Link>
      </motion.div>

      {/* Trust line */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[10px] sm:text-[11px] font-mono uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600"
      >
        <span className="flex items-center gap-1.5">
          <FiLock className="w-3 h-3" /> Non-Custodial
        </span>
        <span className="flex items-center gap-1.5">
          <FiCheckCircle className="w-3 h-3" /> Spot And Futures Trading
        </span>
        <span className="flex items-center gap-1.5">
          <FiGlobe className="w-3 h-3" /> 5+ Chains
        </span>
      </motion.div>
    </section>
  );
}

// ─── Stats Strip ────────────────────────────────────────────
function StatsStrip() {
  return (
    <section className="container mx-auto px-4 sm:px-6 mb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-200/60 dark:bg-white/5 rounded-2xl overflow-hidden border border-gray-200/60 dark:border-white/5"
      >
        {stats.map((s, i) => (
          <div
            key={i}
            className="bg-white/70 dark:bg-[#0a0c10]/80 backdrop-blur-md px-6 py-8 text-center"
          >
            <div className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
              {s.value}
            </div>
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 dark:text-slate-500 mt-2">
              {s.label}
            </div>
          </div>
        ))}
      </motion.div>
    </section>
  );
}

// ─── Features ───────────────────────────────────────────────
function FeatureSection() {
  return (
    <section className="container mx-auto px-4 sm:px-6 mb-24 md:mb-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="text-center mb-12 md:mb-16"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200/60 dark:border-white/5 bg-white/60 dark:bg-white/[0.03] mb-4">
          <FiCpu className="w-3 h-3 text-blue-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500">
            Core Capabilities
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
          Built for traders who <span className="text-blue-500">think in code.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`group relative p-6 sm:p-8 rounded-2xl border border-gray-200/60 dark:border-white/5 bg-white/60 dark:bg-white/[0.02] backdrop-blur-md ${f.border} transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${f.glow}`}
          >
            <div className={`w-11 h-11 rounded-xl bg-gray-100 dark:bg-white/[0.04] flex items-center justify-center mb-5 ${f.color} ${f.bg} transition-colors`}>
              {f.icon}
            </div>
            <h3 className="text-gray-900 dark:text-white font-bold text-base sm:text-lg mb-2">
              {f.title}
            </h3>
            <p className="text-gray-500 dark:text-slate-500 text-xs sm:text-sm leading-relaxed">
              {f.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

// ─── Terminal Mockup ────────────────────────────────────────
function TerminalMockup() {
  const [logs, setLogs] = useState<{ time: string; msg: string; type: string }[]>([]);
  const [typedText, setTypedText] = useState("");
  const [tickerIndex, setTickerIndex] = useState(0);
  const fullText = "IF BTC < 65000 AND RSI < 30 THEN BUY";

  const logPool = [
    { msg: "[BTC_5X_001] position Pnl update...", type: "info" },
    { msg: "[ETH_3X_002] position closed...", type: "info" },
    { msg: "[BTC_5X_001] trailing updated..", type: "signal" },
    { msg: "[HYPE_BTC_5X_001] order position opened (isolated, 5x leverage)", type: "exec" },
    { msg: "[BTC_5X_001] position opened LONG @ $64,281", type: "success" },
    { msg: "[BTC_5X_001] TP set at $66,120 (+2.86%)", type: "success" },
    { msg: "[BTC_5X_001] SL set at $63,100 (-1.84%)", type: "warn" },
    { msg: "[BTC_5X_001] Technical threshold updated", type: "warn" },
  ];

  const tickerData = [
    { pair: "BTC/USDT", price: "$81,281.50", change: "+2.41%", up: true },
    { pair: "ETH/USDT", price: "$3,142.18", change: "+1.87%", up: true },
    { pair: "SOL/USDT", price: "$142.66", change: "-0.52%", up: false },
    { pair: "ARB/USDT", price: "$0.8421", change: "+3.12%", up: true },
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString([], {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const entry = logPool[i % logPool.length];
      setLogs((prev) => [{ time, ...entry }, ...prev].slice(0, 6));
      i++;
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let i = 0;
    let deleting = false;
    const interval = setInterval(() => {
      if (!deleting) {
        setTypedText(fullText.slice(0, i));
        i++;
        if (i > fullText.length) {
          deleting = true;
          setTimeout(() => { }, 1800);
        }
      } else {
        setTypedText(fullText.slice(0, i));
        i--;
        if (i < 0) {
          deleting = false;
          i = 0;
        }
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerData.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const getLogColor = (type: string) => {
    switch (type) {
      case "success": return "text-emerald-500 dark:text-emerald-400";
      case "signal": return "text-blue-500 dark:text-blue-400";
      case "exec": return "text-purple-500 dark:text-purple-400";
      case "warn": return "text-amber-500 dark:text-amber-400";
      default: return "text-gray-500 dark:text-slate-500";
    }
  };

  return (
    <section className="container mx-auto px-4 sm:px-6 mb-24 md:mb-32">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="text-center mb-12"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-gray-200/60 dark:border-white/5 bg-white/60 dark:bg-white/[0.03] mb-4">
          <FiBarChart2 className="w-3 h-3 text-purple-500" />
          <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500 dark:text-slate-500">
            Live Terminal Preview
          </span>
        </div>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white">
          Your command center.
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: 0.7 }}
        className="relative group max-w-5xl mx-auto rounded-2xl sm:rounded-3xl border border-gray-200/60 dark:border-white/5 bg-white/90 dark:bg-[#0a0c10] p-2 sm:p-3 shadow-2xl shadow-gray-300/30 dark:shadow-black/50 overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none" />

        {/* Title bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200/60 dark:border-white/5 relative z-10">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          </div>
          <div className="text-[9px] font-mono text-gray-500 dark:text-slate-500 uppercase tracking-[0.25em] truncate">
            pulsetrader://execution-core/v2
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-emerald-500 animate-pulse">● LIVE</span>
          </div>
        </div>

        {/* Ticker */}
        <div className="border-b border-gray-200/60 dark:border-white/5 px-4 sm:px-6 py-2 overflow-hidden">
          <div className="flex items-center gap-6 text-[10px] font-mono whitespace-nowrap">
            {tickerData.map((t, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 transition-opacity duration-500 ${i === tickerIndex ? "opacity-100" : "opacity-40"
                  }`}
              >
                <span className="text-gray-500 dark:text-slate-500">{t.pair}</span>
                <span className="text-gray-900 dark:text-white font-bold">{t.price}</span>
                <span className={t.up ? "text-emerald-500" : "text-red-500"}>
                  {t.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left: Strategy builder */}
          <div className="p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-gray-200/60 dark:border-white/5 bg-gray-50/50 dark:bg-black/20 flex flex-col items-center justify-center min-h-[280px] relative">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600 mb-4 self-start">
              &gt; strategy.builder
            </div>
            <div className="relative w-full max-w-sm">
              <div className="bg-white dark:bg-blue-500/[0.06] border border-blue-200 dark:border-blue-500/20 px-5 py-4 rounded-xl shadow-sm">
                <code className="text-sm font-mono text-gray-800 dark:text-blue-300 tracking-wide break-all">
                  {typedText}
                  <span className="animate-pulse text-blue-500">|</span>
                </code>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-[10px] font-mono uppercase tracking-[0.15em]">
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                EMA-20: <span className="text-gray-900 dark:text-white font-bold">$64,281</span>
              </span>
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-white/[0.03] border border-gray-200/60 dark:border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                RSI: <span className="text-gray-900 dark:text-white font-bold">28.4</span>
              </span>
            </div>
          </div>

          {/* Right: Log feed */}
          <div className="p-6 sm:p-8 font-mono text-[11px] leading-relaxed relative min-h-[280px] flex flex-col">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600 mb-4">
              &gt; system.feed
            </div>

            <div className="space-y-2 flex-1">
              <AnimatePresence mode="popLayout">
                {logs.map((log, idx) => (
                  <motion.div
                    key={`${log.time}-${idx}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1 - idx * 0.15, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className={`flex items-start gap-3 ${idx === 0 ? "font-bold" : ""}`}
                  >
                    <span className="text-gray-400 dark:text-slate-700 shrink-0">
                      [{log.time}]
                    </span>
                    <span className={getLogColor(log.type)}>{log.msg}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {logs.length === 0 && (
                <div className="text-gray-400 dark:text-slate-700 italic">
                  Initializing data stream...
                </div>
              )}
            </div>

            <div className="mt-6 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold tracking-wide uppercase">
                  Auto-Execute Ready
                </span>
              </div>
              <div className="flex -space-x-1.5">
                {["₿", "Ξ", "◎"].map((sym, i) => (
                  <div
                    key={i}
                    className="w-5 h-5 rounded-full border-2 border-white dark:border-[#0a0c10] bg-blue-500 flex items-center justify-center text-[9px] text-white font-bold"
                  >
                    {sym}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}



// ─── Final CTA ──────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="container mx-auto px-4 sm:px-6 mb-24">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        className="max-w-3xl mx-auto text-center"
      >
        <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-gray-900 dark:text-white mb-6">
          Ready to start trading?
        </h2>
        <p className="text-gray-500 dark:text-slate-400 mb-8 text-sm sm:text-base">
          Connect your wallet and deploy your first strategy in under 60 seconds.
        </p>
        <Link
          href="/strategy"
          className="group inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-full shadow-xl hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] transition-all text-sm sm:text-base"
        >
          Launch Terminal
          <FiArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </section>
  );
}

// ─── Footer ─────────────────────────────────────────────────
function Footer() {
  return (
    <div className="relative z-10 py-2 border-t border-gray-200/60 dark:border-white/5">
      <div className="container mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[10px] font-mono text-gray-400 dark:text-slate-700 tracking-[0.3em] uppercase">
          PulseTrader Terminal © {new Date().getFullYear()}
        </p>
        <div className="flex items-center gap-6 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 dark:text-slate-600">
          <Link href="/docs" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Docs
          </Link>
          <Link href="/strategy" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Terminal
          </Link>
          <Link href="/screener" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            Screener
          </Link>
        </div>
      </div>
    </div>
  );
}