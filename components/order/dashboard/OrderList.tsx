import { memo, useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FiSearch,
  FiX,
  FiAlertCircle,
  FiFilter,
  FiArrowRight,
  FiList,
  FiTerminal,
} from "react-icons/fi";
import { LuChartCandlestick } from "react-icons/lu";
import { BiWallet } from "react-icons/bi";
import { CiGrid2H, CiGrid41 } from "react-icons/ci";
import { RiRefreshLine } from "react-icons/ri";
import { motion, AnimatePresence } from "framer-motion";

// Types
import { OrderType } from "@/type/order";

// Hooks & Store
import { useOrder } from "@/hooks/useOrder";
import { useChartDataStore } from "@/store/useChartData";
import { useShallow } from "zustand/shallow";
import type { MarketSnapshotRef, StableMarketTokenInfo } from "@/type/market";

// Components
import StrategyGrouped from "./StrategyGrouped";
import OrderTable from "./OrderTable";
import OrderLogTerminal from "./OrderLogTerminal";

interface OrderListParams {
  network?: number;
  userOrders: OrderType[];
  orderCategory?: string;
  walletAddress?: string | undefined;
  walletId?: string | undefined;
  isConnected: boolean;
  tokenInfo?: StableMarketTokenInfo | null;
  marketSnapshotRef?: MarketSnapshotRef;
  protocol?: string;
}

function getInitialTableView(): boolean {
  if (typeof window === "undefined") return true;
  return window.innerWidth >= 768;
}

type ViewMode = "orders" | "terminal";

const OrderList = ({
  network,
  userOrders,
  orderCategory,
  walletAddress,
  walletId,
  isConnected,
  tokenInfo,
  marketSnapshotRef,
  protocol,
}: OrderListParams) => {
  const { getOrders } = useOrder();
  const { setOrdersOnChart } = useChartDataStore(
    useShallow((state: any) => ({
      setOrdersOnChart: state.setOrdersOnChart,
    }))
  );

  // State
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showChartDisplayFilter, setShowChartDisplayFilter] = useState(false);

  // Top-level view: Orders vs Terminal
  const [viewMode, setViewMode] = useState<ViewMode>("orders");

  // Filters
  const [orderModeFilter, setOrderModeFilter] = useState<string>("all");
  const [chartDisplayMode, setChartDisplayMode] = useState<string>("none");
  const [categoryFilter, setCategoryFilter] = useState(orderCategory);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  // View Mode — table on desktop, grid on mobile
  const [isTableOrder, setIsTableOrder] = useState<boolean>(getInitialTableView);

  // Sync categoryFilter when the orderCategory prop changes
  useEffect(() => {
    setCategoryFilter(orderCategory);
  }, [orderCategory]);

  // Responsive: switch view automatically on resize
  useEffect(() => {
    function handleResize() {
      setIsTableOrder(window.innerWidth >= 768);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ─── Filtering ─────────────────────────────────────────────────
  const tokenAddressFilter = tokenInfo?.address?.toLowerCase() ?? "";

  const filteredOrders = useMemo(() => {
    return userOrders.filter((o) => {
      if (network !== undefined && o.chainId !== network) return false;

      if (walletId || walletAddress) {
        const oWalletId = typeof o.wallet === "object" ? o.wallet?._id : o.wallet;
        const orderWalletAddr = o.wallet?.address;

        if (walletId && oWalletId?.toString() !== walletId.toString()) {
          return false;
        }
        if (walletAddress && !walletId) {
          if (
            !orderWalletAddr ||
            orderWalletAddr.toLowerCase() !== walletAddress.toLowerCase()
          ) {
            return false;
          }
        }
      }

      if (protocol) {
        if (o.category === "perpetual" && o.perp?.protocol !== protocol) return false;
      }

      if (tokenAddressFilter) {
        const term = tokenAddressFilter;
        let isMatch = false;
        if (o.category === "spot") {
          const spotOrderMatched =
            o?.orderAsset?.orderToken?.address?.toLowerCase() === term;
          const spotColMatched =
            o?.orderAsset?.collateralToken?.address?.toLowerCase() === term;
          isMatch = spotOrderMatched || spotColMatched;
        } else {
          const perpIndexMatched =
            o.orderAsset?.orderToken?.address?.toLowerCase() === term;
          isMatch = perpIndexMatched;
        }
        if (!isMatch) return false;
      }

      if (categoryFilter !== "all" && o.category !== categoryFilter) return false;
      if (orderModeFilter !== "all" && o.orderMode !== orderModeFilter) return false;
      if (statusFilter !== "all" && o.orderStatus !== statusFilter) return false;

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = o.name?.toLowerCase().includes(term) ?? false;
        const matchesId = o._id?.toLowerCase().includes(term) ?? false;
        if (!matchesName && !matchesId) return false;
      }

      return true;
    });
  }, [
    userOrders,
    network,
    walletAddress,
    walletId,
    tokenAddressFilter,
    protocol,
    categoryFilter,
    statusFilter,
    searchTerm,
    orderModeFilter,
  ]);

  // ─── Sorting ───────────────────────────────────────────────────
  const sortedOrders = useMemo(() => {
    return [...filteredOrders].sort((a: any, b: any) => {
      const timeA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
      const timeB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      const safeA = isNaN(timeA) ? 0 : timeA;
      const safeB = isNaN(timeB) ? 0 : timeB;
      return sortOrder === "asc" ? safeA - safeB : safeB - safeA;
    });
  }, [filteredOrders, sortBy, sortOrder]);

  // ─── Update chart orders when mode or filtered orders change ────
  useEffect(() => {
    if (chartDisplayMode === "none") {
      setOrdersOnChart([]);
      return;
    }

    let ordersToShow: OrderType[] = [];
    if (chartDisplayMode === "all") {
      ordersToShow = filteredOrders;
    } else if (chartDisplayMode === "pending") {
      ordersToShow = filteredOrders.filter((o) => o.orderStatus === "PENDING");
    } else if (chartDisplayMode === "opened") {
      ordersToShow = filteredOrders.filter((o) => o.orderStatus === "OPENED");
    } else if (chartDisplayMode === "closed") {
      ordersToShow = filteredOrders.filter((o) => o.orderStatus === "CLOSED");
    }

    setOrdersOnChart(ordersToShow);
  }, [chartDisplayMode, filteredOrders, setOrdersOnChart]);

  // ─── Clear chart on unmount ─────────────────────────────────────
  useEffect(() => {
    return () => {
      setOrdersOnChart([]);
      setChartDisplayMode("none");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOrdersOnChart]);

  // ─── Grouped orders (for grid view) ─────────────────────────────
  const groupedOrders = useMemo(() => {
    return sortedOrders.reduce((groups, order) => {
      const key = order.name || "Untitled";
      if (!groups[key]) {
        groups[key] = {
          orders: [],
          strategy: order.strategy,
          category: order.category,
          protocol: order.perp?.protocol || "spot",
          stats: { total: 0, pending: 0, opened: 0, reverted: 0, closed: 0 },
        };
      }

      groups[key].orders.push(order);
      groups[key].stats.total++;

      switch (order.orderStatus) {
        case "PENDING":
          groups[key].stats.pending++;
          break;
        case "OPENED":
          groups[key].stats.opened++;
          break;
        case "REVERTED":
        case "CANCELLED":
          groups[key].stats.reverted++;
          break;
        default:
          break;
      }

      return groups;
    }, {} as Record<string, any>);
  }, [sortedOrders]);

  // ─── Active filters flag ───────────────────────────────────────
  const hasActiveFilters = useMemo(
    () =>
      categoryFilter !== orderCategory ||
      statusFilter !== "all" ||
      searchTerm !== "" ||
      sortBy !== "createdAt" ||
      sortOrder !== "desc",
    [categoryFilter, orderCategory, statusFilter, searchTerm, sortBy, sortOrder]
  );

  // ─── Handlers ──────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await getOrders();
    } catch {
      setError("Failed to refresh orders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getOrders]);

  const handleClearFilters = useCallback(() => {
    setCategoryFilter(orderCategory);
    setStatusFilter("all");
    setSearchTerm("");
    setSortBy("createdAt");
    setSortOrder("desc");
  }, [orderCategory]);

  const handleChartModeSelect = (mode: string) => {
    setChartDisplayMode(mode);
  };

  // ─── Not connected ─────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="w-full h-full min-h-0 flex flex-col rounded-2xl border border-gray-200/50 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0c10]/90 backdrop-blur-sm overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto flex items-center justify-center p-4">
          <div className="w-full max-w-sm p-6 sm:p-8 rounded-2xl border border-gray-200/50 dark:border-white/[0.05] bg-white/70 dark:bg-white/[0.02] backdrop-blur-sm flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
              <BiWallet className="w-6 h-6 text-blue-400" />
            </div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">
              Connect Your Wallet
            </h3>
            <p className="text-gray-500 dark:text-slate-400 mb-4 text-xs max-w-xs leading-relaxed">
              Connect your wallet to view and manage your orders.
            </p>
            <Link href="/connect">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-500/25 transition-all group"
              >
                <BiWallet className="w-3.5 h-3.5" />
                Connect Wallet
                <FiArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </motion.button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Render ───────────────────────────────────────────────
  return (
    <div className="w-full h-full min-h-0 flex flex-col rounded-2xl border border-gray-200/50 dark:border-white/[0.06] bg-white/80 dark:bg-[#0a0c10]/90 backdrop-blur-sm overflow-hidden">
      {/* ── Header Toolbar (fixed, does not scroll) ──────────────── */}
      <div className="shrink-0 px-4 py-2 bg-gray-50/80 dark:bg-black/30 border-b border-gray-200/50 dark:border-white/[0.05] backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:mx-3">
          {/* Left: title + counts */}
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center p-1 rounded-xl bg-gray-100/80 dark:bg-white/[0.05] border border-gray-200/50 dark:border-white/[0.06] w-fit">
              <button
                onClick={() => setViewMode("orders")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === "orders"
                  ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                <FiList className="w-3.5 h-3.5" />
                Orders
              </button>
              <button
                onClick={() => setViewMode("terminal")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${viewMode === "terminal"
                  ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-emerald-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                <FiTerminal className="w-3.5 h-3.5" />
                Terminal
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono text-slate-400">
                {userOrders.length} total
              </span>
              {sortedOrders.length !== userOrders.length && (
                <span className="text-[10px] font-mono text-blue-400">
                  · {sortedOrders.length} filtered
                </span>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Grid/Table switcher — only when in Orders view */}
            {viewMode === "orders" && (
              <div className="flex items-center p-1 rounded-xl bg-gray-100/80 dark:bg-white/[0.05] border border-gray-200/50 dark:border-white/[0.06]">
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setIsTableOrder(false)}
                  title="Group View"
                  className={`p-1.5 rounded-lg transition-all duration-200 ${!isTableOrder
                    ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                >
                  <CiGrid41 className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  onClick={() => setIsTableOrder(true)}
                  title="Table View"
                  className={`p-1.5 rounded-lg transition-all duration-200 ${isTableOrder
                    ? "bg-white dark:bg-white/10 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                >
                  <CiGrid2H className="w-4 h-4" />
                </motion.button>
              </div>
            )}

            {/* Chart Display */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowChartDisplayFilter(!showChartDisplayFilter)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${showChartDisplayFilter || chartDisplayMode !== "none"
                ? "bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400"
                : "bg-white/60 dark:bg-white/[0.04] border-gray-200/50 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 hover:border-blue-400/30"
                }`}
            >
              <LuChartCandlestick className="w-3.5 h-3.5" />
              Chart
              {chartDisplayMode !== "none" && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </motion.button>

            {/* Filter toggle */}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${showFilters || hasActiveFilters
                ? "bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400"
                : "bg-white/60 dark:bg-white/[0.04] border-gray-200/50 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 hover:border-blue-400/30"
                }`}
            >
              <FiFilter className="w-3.5 h-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </motion.button>

            {/* Refresh */}
            <motion.button
              whileTap={{ scale: 0.9, rotate: 180 }}
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-xl bg-white/60 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.06] text-gray-500 dark:text-gray-400 hover:border-blue-400/30 hover:text-blue-500 transition-all disabled:opacity-40"
              title="Refresh"
            >
              <RiRefreshLine
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </motion.button>
          </div>
        </div>

        {/* ── Chart Display Panel ── */}
        <AnimatePresence>
          {showChartDisplayFilter && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden mt-3"
            >
              <div className="p-3 rounded-xl bg-gray-100/80 dark:bg-white/[0.03] border border-gray-200/40 dark:border-white/[0.05]">
                <p className="text-[9px] font-mono uppercase tracking-widest text-slate-400 mb-2">
                  Chart Display Mode
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["none", "all", "pending", "opened", "closed"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleChartModeSelect(mode)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${chartDisplayMode === mode
                        ? "bg-blue-600 text-white shadow shadow-blue-500/30"
                        : "bg-white dark:bg-white/[0.05] border border-gray-200/50 dark:border-white/[0.06] text-gray-600 dark:text-gray-400 hover:border-blue-400/30"
                        }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Advanced Filters Panel ── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden mt-3"
            >
              <div className="p-3 rounded-xl bg-gray-100/80 dark:bg-white/[0.03] border border-gray-200/40 dark:border-white/[0.05] space-y-3">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-gray-200/50 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-white focus:ring-2 focus:ring-blue-500/40 outline-none transition-all placeholder:text-gray-400 dark:placeholder:text-slate-600"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FiX className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200/50 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All Categories</option>
                    <option value="spot">Spot</option>
                    <option value="perpetual">Perpetual</option>
                  </select>

                  <select
                    value={orderModeFilter}
                    onChange={(e) => setOrderModeFilter(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200/50 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="all">All Modes</option>
                    <option value="Live">Live</option>
                    <option value="Testnet">Testnet</option>
                    <option value="Demo">Demo</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200/50 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="createdAt">Sort: Created</option>
                    <option value="updatedAt">Sort: Updated</option>
                  </select>

                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm rounded-xl border border-gray-200/50 dark:border-white/[0.08] bg-white dark:bg-white/[0.04] dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    <option value="desc">Newest First</option>
                    <option value="asc">Oldest First</option>
                  </select>

                  {hasActiveFilters && (
                    <button
                      onClick={handleClearFilters}
                      className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl border border-red-200/50 dark:border-red-800/50 transition-colors whitespace-nowrap"
                    >
                      <FiX className="w-3.5 h-3.5" /> Clear
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content Area (flex-1 + min-h-0 so it scrolls internally) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 p-3 bg-red-50/80 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-2xl border border-red-200/50 dark:border-red-500/20 flex items-center gap-2 text-sm"
          >
            <FiAlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </motion.div>
        )}

        {sortedOrders.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div className="w-20 h-20 rounded-3xl bg-gray-100/80 dark:bg-white/[0.04] border border-gray-200/50 dark:border-white/[0.06] flex items-center justify-center mb-5">
              <FiSearch className="w-9 h-9 text-gray-300 dark:text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-1">
              {hasActiveFilters ? "No orders match your filters" : "No orders yet"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-500 max-w-xs">
              {hasActiveFilters
                ? "Try adjusting your filters to see more results."
                : "Go to Strategy to create your first automated order."}
            </p>
            {hasActiveFilters ? (
              <button
                onClick={handleClearFilters}
                className="mt-4 px-4 py-2 text-sm font-semibold text-blue-500 hover:bg-blue-500/10 rounded-xl border border-blue-500/20 transition-colors"
              >
                Clear all filters
              </button>
            ) : (
              <Link href="/strategy">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20"
                >
                  Start a Strategy <FiArrowRight className="w-4 h-4" />
                </motion.button>
              </Link>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="wait">
            {viewMode === "terminal" ? (
              <motion.div
                key="terminal"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <OrderLogTerminal orders={sortedOrders} />
              </motion.div>
            ) : isTableOrder ? (
              <motion.div
                key="table"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <OrderTable orders={sortedOrders} />
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-2 xl:space-y-3"
              >
                {Object.entries(groupedOrders).map(
                  ([name, data]: [string, any]) => (
                    <StrategyGrouped
                      key={name}
                      strategyName={name}
                      groupData={data}
                      marketSnapshotRef={marketSnapshotRef}
                    />
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

const areEqualOrderListProps = (
  previous: OrderListParams,
  next: OrderListParams
) => {
  return (
    previous.network === next.network &&
    previous.userOrders === next.userOrders &&
    previous.orderCategory === next.orderCategory &&
    previous.walletAddress === next.walletAddress &&
    previous.walletId === next.walletId &&
    previous.isConnected === next.isConnected &&
    previous.protocol === next.protocol &&
    previous.marketSnapshotRef === next.marketSnapshotRef &&
    previous.tokenInfo?.address === next.tokenInfo?.address &&
    previous.tokenInfo?.chainId === next.tokenInfo?.chainId
  );
};

export default memo(OrderList, areEqualOrderListProps);