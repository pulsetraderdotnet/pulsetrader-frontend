"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiTrendingUp,
  FiChevronDown,
  FiChevronUp,
  FiAlertTriangle,
  FiLink,
  FiZap,
} from "react-icons/fi";
import { MdSwapHoriz } from "react-icons/md";

import LeverageInput from "./TradeBoxCommon/LeverageInput";
import TakeProfitInput from "./TradeBoxCommon/TakeProfit";
import StopLossInput from "./TradeBoxCommon/StopLoss";
import SlippageInput from "./TradeBoxCommon/SlippageTolarence";
import ReEntranceInput from "./TradeBoxCommon/ReEntrance";
import EntryPriceRendering from "./TradeBoxCommon/EntryPriceRendering";
import TechnicalEntry from "./TradeBoxCommon/TechnicalEntry";
import InfoTooltip from "./TradeBoxCommon/BoxTooltip";
import PerpAccountSelect from "@/components/walletManager/selection/perpAccountSelect";
import { useOrder } from "@/hooks/useOrder";

import type { StableMarketTokenInfo } from "@/type/market";
import type { OrderType, OrderTokenType } from "@/type/order";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PairLegConfig {
  isLong: boolean;
  leverage: number;
  initialOrderSize: string;
  entryPrice: string;
  tpPercentage: number;
  slPercentage: number;
  isActiveStopLoss: boolean;
  isTrailingMode: boolean;
  isReEntrance: boolean;
  reEntranceLimit: number;
  slippage: number;
  technicalEntry: any;
  gridsByWallet: Record<number, any>;
  areWalletsReady: boolean;
  estOrders: OrderType[];
}

export interface PairTradingConfig {
  trend: PairLegConfig;
  counterTrend: PairLegConfig;
  sharedOrderName: string;
  orderMode: "Live" | "Demo" | "Testnet";
}

interface PairTradingPanelProps {
  tokenInfo: StableMarketTokenInfo;
  chainId: number;
  isConnected: boolean;
  user?: any;
  userWallets?: any[];
  userPrevOrders?: any[];
  protocol: string;
  isAdvancedSymbol?: boolean;
  collateralToken: any;
  liveTokenPriceUsd: string;
  orderMode: "Live" | "Demo" | "Testnet";
  orderName: string;
  isFeeExempt: boolean;
  feeToken?: OrderTokenType | null;
  setEstOrders: (estOrders: any[]) => void;
  config: {
    minimumOrderSize: number;
    maxGridNumber: number;
    orderTradeFee: number;
    userLevels: any;
  };
  onConfigChange: (config: PairTradingConfig, isReady: boolean) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const createDefaultLeg = (isLong: boolean): PairLegConfig => ({
  isLong,
  leverage: 5,
  initialOrderSize: "",
  entryPrice: "",
  tpPercentage: isLong ? 30 : 5,
  slPercentage: isLong ? 50 : 3,
  isActiveStopLoss: true,
  isTrailingMode: false,
  isReEntrance: !isLong,
  reEntranceLimit: 100,
  slippage: 1,
  technicalEntry: isLong ? null : {
    operator: isLong ? "LESS_THAN" : "GREATER_THAN",
    metric: "rsi",
    timeframe: "1m",
    period: 14,
    value: String(isLong ? 35 : 85),
  },
  gridsByWallet: {},
  areWalletsReady: false,
  estOrders: [],
});

const areOrderListsEqual = (a: OrderType[], b: OrderType[]) => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

// ─── Single Leg Sub-component ─────────────────────────────────────────────────

interface LegPanelProps {
  label: string;
  isTrend: boolean;
  leg: PairLegConfig;
  onChange: (patch: Partial<PairLegConfig>) => void;
  tokenInfo: StableMarketTokenInfo;
  chainId: number;
  protocol: string;
  user: any;
  userWallets: any[];
  userPrevOrders: any[];
  orderMode: "Live" | "Demo" | "Testnet";
  orderName: string;
  collateralToken: any;
  liveTokenPriceUsd: string;
  isFeeExempt: boolean;
  feeToken?: OrderTokenType | null;
  isAdvancedSymbol: boolean;

  config: PairTradingPanelProps["config"];
}

const LegPanel = memo(function LegPanel({
  label,
  isTrend,
  leg,
  onChange,
  tokenInfo,
  chainId,
  protocol,
  user,
  userWallets,
  userPrevOrders,
  orderMode,
  orderName,
  collateralToken,
  liveTokenPriceUsd,
  isFeeExempt,
  feeToken,
  isAdvancedSymbol,
  config,
}: LegPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const maxLeverage = useMemo(() => {
    const parsed = Number(tokenInfo?.maxLeverage);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.max(1, parsed);
  }, [tokenInfo?.maxLeverage]);

  const setGridsByWallet = useCallback(
    (v: Record<number, any>) => onChange({ gridsByWallet: v }),
    [onChange],
  );
  const setWalletsReady = useCallback(
    (v: boolean) => onChange({ areWalletsReady: v }),
    [onChange],
  );

  const gradientHeader = isTrend
    ? "from-violet-600 to-indigo-600"
    : "from-amber-500 to-orange-600";
  const accentColor = isTrend ? "text-violet-400" : "text-amber-400";
  const borderHighlight = leg.isLong
    ? "border-emerald-500/30 from-emerald-500/5 to-teal-500/5"
    : "border-rose-500/30 from-rose-500/5 to-orange-500/5";

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br ${borderHighlight} overflow-hidden transition-all duration-300`}
    >
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded((p) => !p)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r ${gradientHeader} text-white`}
      >
        <div className="flex items-center gap-2">
          {isTrend ? (
            <FiTrendingUp className="w-4 h-4" />
          ) : (
            <FiZap className="w-4 h-4" />
          )}
          <span className="font-bold text-sm tracking-wide">{label}</span>
          <span className="text-xs opacity-70 font-normal">
            {leg.isLong ? "Long ↑" : "Short ↓"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs opacity-80">
          <span>{leg.leverage}x</span>
          {isExpanded ? (
            <FiChevronUp className="w-4 h-4" />
          ) : (
            <FiChevronDown className="w-4 h-4" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-4">

          {/* Direction toggle */}
          <div>
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1 block">
              Direction {!isTrend && <span className="text-amber-400">(auto-synced)</span>}
            </label>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => onChange({ isLong: true })}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${leg.isLong
                  ? "bg-emerald-500 text-white shadow"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={() => onChange({ isLong: false })}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${!leg.isLong
                  ? "bg-rose-500 text-white shadow"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                Short
              </button>
            </div>
          </div>

          {/* Initial Order Size (Margin) Override */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              Order Margin Override
              <InfoTooltip
                id={`margin-override-${label}`}
                content="Manually adjust the calculated margin for this leg. This overrides the automatic allocation."
              />
            </label>
            <div className="relative">
              <input
                type="number"
                value={leg.initialOrderSize}
                onChange={(e) => onChange({ initialOrderSize: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 dark:bg-[#1e2329] border border-gray-200 dark:border-[#2b3139] rounded-lg text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 transition-shadow pr-12"
                placeholder="0.0"
                min="0"
                step="0.01"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400 pointer-events-none">
                {collateralToken?.symbol}
              </div>
            </div>
          </div>

          {/* Entry: algo for CT, price for trend */}
          {!isTrend ? (
            <div>
              <label className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-widest mb-1 ${accentColor}`}>
                <FiZap className="w-3 h-3" /> CT Algo Entry
                <InfoTooltip
                  id="ct-algo-entry-tooltip"
                  content="Counter-trend leg uses algorithmic indicators to decide when to enter and exit short-term positions."
                />
              </label>
              <TechnicalEntry
                technicalEntries={leg.technicalEntry}
                setTechnicalEntries={(v: any) => onChange({ technicalEntry: v })}
                title="CT Entry Conditions"
                isPerp={true}
                isAdvancedSymbol={isAdvancedSymbol}
              />
            </div>
          ) : (
            <EntryPriceRendering
              setEntryPrice={(v) => onChange({ entryPrice: v })}
              label="Trend Entry Price"
              tooltipText="Price at which the trend (primary) position opens"
              tokenInfo={tokenInfo}
              currentPriceUsd={liveTokenPriceUsd}
            />
          )}



          {/* TP/SL */}
          <TakeProfitInput
            takeProfitPercentage={leg.tpPercentage}
            onTakeProfitPercentageChange={(v) => onChange({ tpPercentage: v })}
            isTrailingMode={leg.isTrailingMode}
            handleTrailingMode={(v) =>
              onChange({ isTrailingMode: v, isActiveStopLoss: v ? true : leg.isActiveStopLoss })
            }
            initialOrderSize={leg.initialOrderSize}
            collateralToken={collateralToken}
            trailingMode={label === 'Trend Order' ? false : true}
            additionalLabel={`${label === 'Trend Order' ? 'Net Hedge TP' : ''}`}
          />

          <StopLossInput
            isActive={leg.isActiveStopLoss}
            setIsActive={(v) => onChange({ isActiveStopLoss: v })}
            isTrailingMode={leg.isTrailingMode}
            stopLossPercentage={leg.slPercentage}
            setStopLossPercentage={(v) => onChange({ slPercentage: v })}
            notValid={leg.isTrailingMode && leg.slPercentage === 0}
            additionalLabel={`${label === 'Trend Order' ? 'Net Hedge SL' : ''}`}
          />

          <SlippageInput slippage={leg.slippage} onChange={(v) => onChange({ slippage: v })} />

          {
            label != 'Trend Order' && <ReEntranceInput
              isReEntrance={leg.isReEntrance}
              setIsReEntrance={(v) => onChange({ isReEntrance: v })}
              reEntranceLimit={leg.reEntranceLimit}
              setReEntranceLimit={(v) => onChange({ reEntranceLimit: v })}
            />
          }


          {/* Wallet Selector */}
          {user?.account && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label className={`text-xs font-semibold uppercase tracking-widest mb-2 block ${accentColor}`}>
                {isTrend ? "Trend" : "Counter-Trend"} Wallet
              </label>
              <PerpAccountSelect
                protocol={protocol}
                category="perpetual"
                orders={userPrevOrders}
                availableWallets={userWallets}
                gridsByWallet={leg.gridsByWallet}
                setGridsByWallet={setGridsByWallet}
                orderMode={orderMode}
                areWalletsReady={leg.areWalletsReady}
                setWalletsReady={setWalletsReady}
                chainId={chainId}
                collateralToken={collateralToken}
                selectedStrategy={{ id: "pairTrading" }}
                estOrders={leg.estOrders}
                user={user}
                feeToken={isFeeExempt ? undefined : feeToken}
                onPerpTradeGateChange={() => { }}
                isFeeExempt={isFeeExempt}
                orderTradeFee={config.orderTradeFee || 10}
                indexToken={tokenInfo}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
});

// ─── Main PairTradingPanel ─────────────────────────────────────────────────────

export default memo(function PairTradingPanel({
  tokenInfo,
  chainId,
  isConnected,
  user,
  userWallets = [],
  userPrevOrders = [],
  protocol,
  isAdvancedSymbol = false,
  collateralToken,
  liveTokenPriceUsd,
  orderMode,
  orderName,
  isFeeExempt,
  feeToken,
  config,
  setEstOrders,
  onConfigChange,
}: PairTradingPanelProps) {
  const { configurePerpOrder } = useOrder();
  const configurePerpOrderRef = useRef(configurePerpOrder);
  configurePerpOrderRef.current = configurePerpOrder;

  const [trendLeg, setTrendLeg] = useState<PairLegConfig>(() => createDefaultLeg(true));
  const [ctLeg, setCtLeg] = useState<PairLegConfig>(() => createDefaultLeg(false));

  const [totalCollateral, setTotalCollateral] = useState<string>("");
  const [trendLeverage, setTrendLeverage] = useState<number>(1);
  const [leverageRatio, setLeverageRatio] = useState<number>(5);


  // Helper: build configurePerpOrder config for a leg
  const buildLegOrderConfig = useCallback((leg: PairLegConfig, lev: number, orderLabel?: "trend" | "counterTrend") => {
    const currentPrice = liveTokenPriceUsd || tokenInfo?.priceUsd || "0";
    const targetPrice = leg.entryPrice && Number(leg.entryPrice) > 0 ? leg.entryPrice : currentPrice;
    return {
      gridNumber: 1,
      targetPrice,
      activeStopLoss: leg.isActiveStopLoss,
      entryLogic: leg.technicalEntry && !(leg.technicalEntry as any).targetWeight ? leg.technicalEntry : null,
      entryWeight: leg.technicalEntry && (leg.technicalEntry as any).targetWeight ? leg.technicalEntry : null,
      entryType: leg.technicalEntry
        ? ((leg.technicalEntry as any).targetWeight ? "weight" : "logic")
        : "price",
      mode: orderMode,
      orderSizeMultiplier: 1,
      initialOrderSize: leg.initialOrderSize || "0",
      gridMultiplier: 1,
      gridDistance: 1,
      collateralToken,
      outputToken: collateralToken,  // perp: output token is same as collateral
      orderToken: tokenInfo,
      priority: 1,
      executionSpeed: "normal",
      orderName,
      strategy: "pairTrading",
      chainId,
      isTrailingMode: leg.isTrailingMode,
      tpPrice: "",
      tpPercentage: leg.tpPercentage,
      slPercentage: leg.slPercentage,
      isReEntrance: leg.isReEntrance,
      reEntranceLimit: leg.reEntranceLimit,
      slippage: leg.slippage,
      leverage: lev,
      isLong: leg.isLong,
      protocol,
      feeToken: isFeeExempt ? null : feeToken,
      user,
      orderLabel,
      orderLable: orderLabel,
      additional: {
        orderLabel,
        orderLable: orderLabel,
      },
    };
  }, [orderMode, collateralToken, tokenInfo, orderName, chainId, protocol, feeToken, isFeeExempt, user, liveTokenPriceUsd]);

  // ── Resolved max leverage from tokenInfo ────────────────────────────────
  const maxLeverage = useMemo(() => {
    const parsed = Number(tokenInfo?.maxLeverage);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.max(1, parsed);
  }, [tokenInfo?.maxLeverage]);

  // Clamp trendLeverage when maxLeverage changes
  useEffect(() => {
    if (trendLeverage > maxLeverage) {
      setTrendLeverage(maxLeverage);
    }
  }, [maxLeverage, trendLeverage]);

  // Calculate and sync margins & leverages based on total collateral and ratio
  useEffect(() => {
    const collat = Number(totalCollateral) || 0;
    const ratio = leverageRatio || 1;

    // To have equal position sizes: C_T * L_T = C_C * (L_T * ratio)
    // => C_T = C_C * ratio
    // C_Total = C_T + C_C = C_C * ratio + C_C = C_C * (ratio + 1)
    const ctMargin = collat / (ratio + 1);
    const trendMargin = collat - ctMargin;
    // Clamp CT leverage to maxLeverage
    const rawCtLev = trendLeverage * ratio;
    const ctLev = Math.min(rawCtLev, maxLeverage);

    const trendOrderSize = trendMargin > 0 ? trendMargin.toFixed(4) : "";
    const ctOrderSize = ctMargin > 0 ? ctMargin.toFixed(4) : "";

    setTrendLeg((prev) => ({
      ...prev,
      leverage: trendLeverage,
      initialOrderSize: trendOrderSize,
    }));

    setCtLeg((prev) => ({
      ...prev,
      leverage: ctLev,
      initialOrderSize: ctOrderSize,
    }));
  }, [totalCollateral, trendLeverage, leverageRatio, maxLeverage]);

  // Seed entry price when token changes
  useEffect(() => {
    const p = liveTokenPriceUsd || tokenInfo?.priceUsd || "";
    if (!p) return;
    setTrendLeg((prev) => (prev.entryPrice ? prev : { ...prev, entryPrice: p }));
    setCtLeg((prev) => (prev.entryPrice ? prev : { ...prev, entryPrice: p }));
  }, [tokenInfo?.address, liveTokenPriceUsd, tokenInfo?.priceUsd]);

  const patchTrend = useCallback(
    (patch: Partial<PairLegConfig>) => setTrendLeg((prev) => ({ ...prev, ...patch })),
    [],
  );
  const patchCt = useCallback(
    (patch: Partial<PairLegConfig>) => setCtLeg((prev) => ({ ...prev, ...patch })),
    [],
  );

  // Keep CT direction always opposite to trend direction
  const prevTrendIsLong = useRef(trendLeg.isLong);
  useEffect(() => {
    if (prevTrendIsLong.current !== trendLeg.isLong) {
      prevTrendIsLong.current = trendLeg.isLong;
      setCtLeg((prev) => ({ ...prev, isLong: !trendLeg.isLong }));
    }
  }, [trendLeg.isLong]);

  // ── Validation ────────────────────────────────────────────────────────
  const { isReady, notReadyReason } = useMemo(() => {
    if (!orderName?.trim())
      return { isReady: false, notReadyReason: "Set an order name" };

    if (!trendLeg.initialOrderSize || Number(trendLeg.initialOrderSize) <= 0)
      return { isReady: false, notReadyReason: "Set trend leg margin" };
    if (!trendLeg.entryPrice || Number(trendLeg.entryPrice) <= 0)
      return { isReady: false, notReadyReason: "Set trend leg entry price" };
    if (trendLeg.leverage <= 0)
      return { isReady: false, notReadyReason: "Set trend leg leverage" };
    if (trendLeg.tpPercentage <= 0)
      return { isReady: false, notReadyReason: "Set trend leg TP %" };
    if (trendLeg.slippage <= 0.4)
      return { isReady: false, notReadyReason: "Trend slippage must be > 0.4" };

    if (!ctLeg.initialOrderSize || Number(ctLeg.initialOrderSize) <= 0)
      return { isReady: false, notReadyReason: "Set CT leg margin" };
    if (!ctLeg.technicalEntry)
      return { isReady: false, notReadyReason: "Configure CT algo entry logic" };
    if (ctLeg.leverage <= 0)
      return { isReady: false, notReadyReason: "Set CT leg leverage" };
    if (ctLeg.tpPercentage <= 0)
      return { isReady: false, notReadyReason: "Set CT leg TP %" };
    if (ctLeg.slippage <= 0.4)
      return { isReady: false, notReadyReason: "CT slippage must be > 0.4" };

    if (trendLeg.leverage > maxLeverage)
      return { isReady: false, notReadyReason: `Trend leverage (${trendLeg.leverage}x) exceeds max allowed (${maxLeverage}x)` };
    if (ctLeg.leverage > maxLeverage)
      return { isReady: false, notReadyReason: `CT leverage (${ctLeg.leverage}x) exceeds max allowed (${maxLeverage}x)` };

    if (!trendLeg.areWalletsReady)
      return { isReady: false, notReadyReason: "Select trend wallet" };
    if (!ctLeg.areWalletsReady)
      return { isReady: false, notReadyReason: "Select CT wallet" };

    const trendWalletId = Object.values(trendLeg.gridsByWallet)?.[0]?._id;
    const ctWalletId = Object.values(ctLeg.gridsByWallet)?.[0]?._id;
    if (trendWalletId && ctWalletId && trendWalletId === ctWalletId)
      return { isReady: false, notReadyReason: "Trend & CT wallets must be different" };

    if (trendLeg.isLong === ctLeg.isLong)
      return { isReady: false, notReadyReason: "Legs must have opposite directions" };

    if (!isConnected)
      return { isReady: false, notReadyReason: "Connect your wallet" };

    return { isReady: true, notReadyReason: "" };
  }, [orderName, trendLeg, ctLeg, isConnected, maxLeverage]);

  // ── Propagate config to parent ─────────────────────────────────────────
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useEffect(() => {
    onConfigChangeRef.current(
      { trend: trendLeg, counterTrend: ctLeg, sharedOrderName: orderName, orderMode },
      isReady,
    );
  }, [trendLeg, ctLeg, orderName, orderMode, isReady]);

  // ── Regenerate real estOrders when leg params change ──────────────────
  const setEstOrdersRef = useRef(setEstOrders);
  setEstOrdersRef.current = setEstOrders;

  useEffect(() => {
    try {
      const currentPrice = liveTokenPriceUsd || tokenInfo?.priceUsd || "0";
      const trendPrice = trendLeg.entryPrice || currentPrice;
      const ctPrice = ctLeg.entryPrice || currentPrice;

      const hasTrendSize = Number(trendLeg.initialOrderSize) > 0;
      const hasCtSize = Number(ctLeg.initialOrderSize) > 0;

      const trendEst = hasTrendSize && Number(trendPrice) > 0
        ? configurePerpOrderRef.current(buildLegOrderConfig({ ...trendLeg, entryPrice: trendPrice }, trendLeg.leverage, "trend"))
        : [];
      const ctEst = hasCtSize && (ctLeg.technicalEntry || Number(ctPrice) > 0)
        ? configurePerpOrderRef.current(buildLegOrderConfig({ ...ctLeg, entryPrice: ctPrice }, ctLeg.leverage, "counterTrend"))
        : [];

      // Store on the legs too so submit logic can read them directly
      setTrendLeg((prev) =>
        areOrderListsEqual(prev.estOrders, trendEst) ? prev : { ...prev, estOrders: trendEst }
      );
      setCtLeg((prev) =>
        areOrderListsEqual(prev.estOrders, ctEst) ? prev : { ...prev, estOrders: ctEst }
      );
      // Push combined list to parent for the order preview table
      setEstOrdersRef.current([...trendEst, ...ctEst]);
    } catch (e) {
      // configurePerpOrder can throw if required fields are missing; ignore until form is complete
      console.warn("PairTrading estOrders generation error:", e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    trendLeg.initialOrderSize, trendLeg.entryPrice, trendLeg.isLong, trendLeg.leverage,
    trendLeg.tpPercentage, trendLeg.slPercentage, trendLeg.isTrailingMode,
    trendLeg.slippage, trendLeg.technicalEntry,
    ctLeg.initialOrderSize, ctLeg.entryPrice, ctLeg.isLong, ctLeg.leverage,
    ctLeg.tpPercentage, ctLeg.slPercentage, ctLeg.isTrailingMode,
    ctLeg.slippage, ctLeg.technicalEntry,
    buildLegOrderConfig,
    liveTokenPriceUsd,
    tokenInfo?.priceUsd,
  ]);

  const trendSelectedWalletId = trendLeg.gridsByWallet?.[1]?._id;
  const ctSelectedWalletId = ctLeg.gridsByWallet?.[1]?._id;

  const trendAvailableWallets = useMemo(() => {
    if (!ctSelectedWalletId) return userWallets;
    return userWallets.filter(w => w._id !== ctSelectedWalletId);
  }, [userWallets, ctSelectedWalletId]);

  const ctAvailableWallets = useMemo(() => {
    if (!trendSelectedWalletId) return userWallets;
    return userWallets.filter(w => w._id !== trendSelectedWalletId);
  }, [userWallets, trendSelectedWalletId]);

  return (
    <div className="space-y-3">
      {/* Info banner */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/40">
        <FiLink className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
          <span className="font-semibold">Pair Trading / Hedge Mode</span> — Hyperliquid
          doesn&apos;t support native hedge mode, so PulseTrader places a{" "}
          <span className="font-semibold text-violet-500">Trend Order</span> and a{" "}
          <span className="font-semibold text-amber-500">Counter-Trend (CT) Order</span>{" "}
          on <span className="font-semibold">two separate wallets</span>. Both share the
          same asset but run independently with different leverage and margin.
        </p>
      </div>

      {/* ── Pair Configuration (Auto-Split) ── */}
      <div className="bg-gray-50 dark:bg-gray-900 p-3 2xl:p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Pair Configuration (Auto-Split)</h4>

        {/* Total Collateral */}
        <div>
          <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
            Total Pair Collateral
            <InfoTooltip
              id="total-collateral-tooltip"
              content="The total amount will be automatically split between the Trend and CT leg so that both maintain the exact same position size."
            />
          </label>
          <div className="relative mt-1">
            <div className="flex bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
              <input
                type="number"
                min="0"
                value={totalCollateral}
                onChange={(e) => setTotalCollateral(e.target.value)}
                className="w-full px-3 py-2.5 bg-transparent outline-none text-gray-900 dark:text-white placeholder:text-sm"
                placeholder="Enter total amount (e.g. 100)"
              />
              <div className="flex items-center pr-3 text-sm text-gray-500 dark:text-gray-400">
                {collateralToken?.imageUrl && (
                  <img
                    src={collateralToken.imageUrl}
                    className="w-4 h-4 rounded-full mr-1"
                    alt={collateralToken.symbol}
                  />
                )}
                {collateralToken?.symbol}
              </div>
            </div>
          </div>
        </div>

        <div className="grid  gap-4">
          {/* Trend Leverage */}
          <div>
            <LeverageInput
              leverage={trendLeverage}
              onLeverageChange={(v) => setTrendLeverage(Math.min(v, maxLeverage))}
              maxLeverage={maxLeverage}
            />
          </div>

          {/* Leverage Ratio */}
          <div>
            <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Leverage Ratio (Trend : CT)
              <InfoTooltip
                id="leverage-ratio-tooltip"
                content="Ratio between Trend Leverage and CT Leverage. A 1:5 ratio means CT uses 5x more leverage than Trend."
              />
            </label>
            <select
              value={leverageRatio}
              onChange={(e) => setLeverageRatio(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1:1</option>
              <option value={2}>1:2</option>
              <option value={3}>1:3</option>
              <option value={4}>1:4</option>
              <option value={5}>1:5</option>
              <option value={10}>1:10</option>
            </select>
          </div>
        </div>

        {/* Display Split Info */}
        {Number(totalCollateral) > 0 && (
          <div className="flex gap-2 text-xs font-medium mt-2">
            <div className="flex-1 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 p-2 rounded-lg border border-violet-200 dark:border-violet-700/40">
              <span className="opacity-80">Trend Leg:</span> <br />
              {Number(trendLeg.initialOrderSize).toFixed(2)} {collateralToken?.symbol} @ {trendLeg.leverage}x
            </div>
            <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 rounded-lg border border-amber-200 dark:border-amber-700/40">
              <span className="opacity-80">CT Leg:</span> <br />
              {Number(ctLeg.initialOrderSize).toFixed(2)} {collateralToken?.symbol} @ {ctLeg.leverage}x
              {trendLeverage * leverageRatio > maxLeverage && (
                <span className="ml-1 text-red-500 dark:text-red-400 font-semibold">
                  (capped at {maxLeverage}x)
                </span>
              )}
            </div>
          </div>
        )}
      </div>



      {/* Direction symmetry indicator */}
      <div className="flex items-center justify-center gap-2 py-1">
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${trendLeg.isLong
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400"
            }`}
        >
          <FiTrendingUp className="w-3 h-3" />
          Trend: {trendLeg.isLong ? "Long" : "Short"}
        </div>
        <MdSwapHoriz className="w-5 h-5 text-gray-400" />
        <div
          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${ctLeg.isLong
            ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400"
            : "bg-rose-50 dark:bg-rose-900/20 border-rose-300 dark:border-rose-700 text-rose-600 dark:text-rose-400"
            }`}
        >
          <FiZap className="w-3 h-3" />
          CT: {ctLeg.isLong ? "Long" : "Short"} (auto)
        </div>
      </div>

      {/* Validation warning */}
      {!isReady && notReadyReason && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-300">
          <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {notReadyReason}
        </div>
      )}

      {/* Trend Leg */}
      <LegPanel
        label="Trend Order"
        isTrend={true}
        leg={trendLeg}
        onChange={patchTrend}
        tokenInfo={tokenInfo}
        chainId={chainId}
        protocol={protocol}
        user={user}
        userWallets={trendAvailableWallets}
        userPrevOrders={userPrevOrders}
        orderMode={orderMode}
        orderName={orderName}
        collateralToken={collateralToken}
        liveTokenPriceUsd={liveTokenPriceUsd}
        isFeeExempt={isFeeExempt}
        feeToken={feeToken}
        isAdvancedSymbol={isAdvancedSymbol}
        config={config}
      />

      {/* Counter-Trend Leg */}
      <LegPanel
        label="Counter-Trend (CT) Order"
        isTrend={false}
        leg={ctLeg}
        onChange={patchCt}
        tokenInfo={tokenInfo}
        chainId={chainId}
        protocol={protocol}
        user={user}
        userWallets={ctAvailableWallets}
        userPrevOrders={userPrevOrders}
        orderMode={orderMode}
        orderName={orderName}
        collateralToken={collateralToken}
        liveTokenPriceUsd={liveTokenPriceUsd}
        isFeeExempt={isFeeExempt}
        feeToken={feeToken}
        isAdvancedSymbol={isAdvancedSymbol}
        config={config}
      />
    </div>
  );
});
