"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits } from "ethers";
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
import GridInput from "./TradeBoxCommon/GridInput";
import NumberInput from "./TradeBoxCommon/NumberInput";
import PerpAccountSelect from "@/components/walletManager/selection/perpAccountSelect";
import { useOrder } from "@/hooks/useOrder";
import { getGridNthPrice } from "@/utility/orderUtility";
import { safeParseUnits } from "@/utility/handy";

import type { StableMarketTokenInfo } from "@/type/market";
import type { OrderType, OrderTokenType } from "@/type/order";

// ─── Module-level stable constants ────────────────────────────────────────────

/** Stable object so PerpAccountSelect doesn't re-render on every parent render. */
const PAIR_TRADING_STRATEGY = { id: "pairTrading" } as const;

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
  isGridEnabled?: boolean;
  gridNumber?: number;
  gridDistance?: number;
  gridMultiplier?: number;
  collateralMultiplier?: number;
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

export const calculateGridWeightsSum = (
  gridNumber: number,
  collateralMultiplier: number,
): number => {
  const n = Math.max(1, Math.floor(gridNumber));
  const m = Number(collateralMultiplier);
  if (!Number.isFinite(m) || m <= 0 || m === 1) return n;
  return (Math.pow(m, n) - 1) / (m - 1);
};

export const isNegativeGridDrop = (
  isLong: boolean,
  distance: number,
  num: number,
  mult: number,
): boolean => {
  if (!isLong) return false;
  if (distance > 0 && num > 1 && mult > 0) {
    if (mult === 1) return distance * (num - 1) >= 100;
    const firstCal = mult ** (num - 1) - 1;
    const secondCal = firstCal / (mult - 1);
    return distance * secondCal >= 100;
  }
  return false;
};

const createDefaultLeg = (isLong: boolean): PairLegConfig => ({
  isLong,
  leverage: 5,
  initialOrderSize: "",
  entryPrice: "",
  tpPercentage: isLong ? 30 : 5,
  slPercentage: isLong ? 50 : 40,
  isActiveStopLoss: true,
  isTrailingMode: false,
  isReEntrance: !isLong,
  reEntranceLimit: 100,
  slippage: 1,
  technicalEntry: isLong
    ? null
    : {
      operator: isLong ? "LESS_THAN" : "GREATER_THAN",
      metric: "rsi",
      timeframe: "1m",
      period: 14,
      value: String(isLong ? 35 : 70),
    },
  isGridEnabled: false,
  gridNumber: 2,
  gridDistance: 10,
  gridMultiplier: 1,
  collateralMultiplier: 2,
  gridsByWallet: {},
  areWalletsReady: false,
  estOrders: [],
});

const areOrderListsEqual = (a: OrderType[], b: OrderType[]): boolean => {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

// ─── Grid price computation ───────────────────────────────────────────────────

export interface GridPriceLevel {
  index: number;
  multiplier: number;
  collateral: number;
  positionSize: number;
  price: number;
  priceStr: string;
}

export const computePairGridPrices = ({
  entryPriceStr,
  gridNumber,
  gridDistance,
  gridMultiplier,
  collateralMultiplier,
  baseCollateral,
  leverage,
  isLong,
}: {
  entryPriceStr: string;
  gridNumber: number;
  gridDistance: number;
  gridMultiplier: number;
  collateralMultiplier: number;
  baseCollateral: number;
  leverage: number;
  isLong: boolean;
}): { levels: GridPriceLevel[]; totalCollateral: number } => {
  const num = Math.max(1, Math.min(Math.floor(gridNumber || 1), 50));
  const dist = Number(gridDistance) > 0 ? Number(gridDistance) : 10;
  const mult = Number(gridMultiplier) > 0 ? Number(gridMultiplier) : 1;
  const colMult = Number(collateralMultiplier) > 0 ? Number(collateralMultiplier) : 1;
  const base = Number(baseCollateral) || 0;
  const lev = Number(leverage) || 1;

  const hasEntry = Boolean(entryPriceStr) && Number(entryPriceStr) > 0;
  const entryBig = hasEntry ? safeParseUnits(String(entryPriceStr), 18) : BigInt(0);

  const levels: GridPriceLevel[] = [];
  let runningMultiplier = 1;
  let totalCollateral = 0;

  for (let i = 1; i <= num; i++) {
    const gridCollateral = base * runningMultiplier;
    const positionSize = gridCollateral * lev;
    totalCollateral += gridCollateral;

    let price = 0;
    if (hasEntry) {
      const nthBig = getGridNthPrice({
        entryPrice: entryBig,
        gridDistance: dist,
        gridMultiplier: mult,
        n: i,
        decrement: isLong,
      });
      price = Number(formatUnits(nthBig, 18));
    }

    levels.push({
      index: i,
      multiplier: runningMultiplier,
      collateral: gridCollateral,
      positionSize,
      price,
      priceStr: price > 0 ? price.toFixed(4) : "--",
    });

    runningMultiplier *= colMult;
  }

  return { levels, totalCollateral };
};

// ─── Grid Collateral Preview Sub-component (memoized) ────────────────────────

const GridCollateralPreview = memo(function GridCollateralPreview({
  gridNumber,
  gridDistance,
  gridMultiplier,
  collateralMultiplier,
  baseCollateral,
  leverage,
  isLong,
  entryPrice,
  collateralSymbol,
}: {
  gridNumber: number;
  gridDistance: number;
  gridMultiplier: number;
  collateralMultiplier: number;
  baseCollateral: number;
  leverage: number;
  isLong: boolean;
  entryPrice: string;
  collateralSymbol?: string;
}) {
  const { levels, totalCollateral } = useMemo(
    () =>
      computePairGridPrices({
        entryPriceStr: entryPrice,
        gridNumber,
        gridDistance,
        gridMultiplier,
        collateralMultiplier,
        baseCollateral,
        leverage,
        isLong,
      }),
    [
      entryPrice,
      gridNumber,
      gridDistance,
      gridMultiplier,
      collateralMultiplier,
      baseCollateral,
      leverage,
      isLong,
    ],
  );

  if (gridNumber < 2 || baseCollateral <= 0) return null;

  return (
    <div className="mt-3 p-3 rounded-lg bg-gray-50 dark:bg-[#1a1f26] border border-gray-200 dark:border-gray-800 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">
          Grid Orders Breakdown ({levels.length} orders)
        </span>
        <span className="text-gray-500 dark:text-gray-400">
          Total:{" "}
          <span className="font-bold text-violet-600 dark:text-violet-400">
            {totalCollateral.toFixed(2)} {collateralSymbol}
          </span>
        </span>
      </div>

      <div className="overflow-x-auto max-h-48 overflow-y-auto">
        <table className="w-full text-[11px] text-left">
          <thead className="text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="py-1 px-1.5 font-medium">#</th>
              <th className="py-1 px-1.5 font-medium">Target Price</th>
              <th className="py-1 px-1.5 font-medium text-right">
                Margin ({collateralSymbol})
              </th>
              <th className="py-1 px-1.5 font-medium text-right">
                Size ({collateralSymbol})
              </th>
              <th className="py-1 px-1.5 font-medium text-right">Scale</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {levels.map((lvl) => (
              <tr
                key={lvl.index}
                className="text-gray-700 dark:text-gray-300 hover:bg-gray-100/50 dark:hover:bg-gray-800/40"
              >
                <td className="py-1 px-1.5 font-semibold">#{lvl.index}</td>
                <td className="py-1 px-1.5 font-mono">
                  {lvl.index === 1 ? (
                    <span className="text-gray-900 dark:text-white">
                      {lvl.priceStr}
                      <span className="text-[9px] text-gray-500 ml-1">(entry)</span>
                    </span>
                  ) : (
                    <span
                      className={
                        isLong
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }
                    >
                      {lvl.priceStr}
                    </span>
                  )}
                </td>
                <td className="py-1 px-1.5 text-right font-mono">
                  {lvl.collateral.toFixed(2)}
                </td>
                <td className="py-1 px-1.5 text-right font-mono text-violet-600 dark:text-violet-400">
                  {lvl.positionSize.toFixed(2)}
                </td>
                <td className="py-1 px-1.5 text-right text-gray-400">
                  {lvl.multiplier}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

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

  // ── Leg ref so callbacks can read latest value without deps churn ──
  const legRef = useRef(leg);
  legRef.current = leg;

  const toggleExpanded = useCallback(() => setIsExpanded((p) => !p), []);

  const setGridsByWallet = useCallback(
    (v: Record<number, any>) => onChange({ gridsByWallet: v }),
    [onChange],
  );
  const setWalletsReady = useCallback(
    (v: boolean) => onChange({ areWalletsReady: v }),
    [onChange],
  );

  // ── Stable field callbacks ─────────────────────────────────────────
  const handleLongClick = useCallback(
    () => onChange({ isLong: true }),
    [onChange],
  );
  const handleShortClick = useCallback(
    () => onChange({ isLong: false }),
    [onChange],
  );
  const handleInitialOrderSizeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ initialOrderSize: e.target.value }),
    [onChange],
  );
  const handleEntryPriceChange = useCallback(
    (v: string) => onChange({ entryPrice: v }),
    [onChange],
  );
  const handleTechnicalEntryChange = useCallback(
    (v: any) => onChange({ technicalEntry: v }),
    [onChange],
  );
  const handleGridToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) =>
      onChange({ isGridEnabled: e.target.checked }),
    [onChange],
  );
  const handleGridNumberChange = useCallback(
    (v: number) => onChange({ gridNumber: v }),
    [onChange],
  );
  const handleGridDistanceChange = useCallback(
    (v: number) => onChange({ gridDistance: v }),
    [onChange],
  );
  const handleGridMultiplierChange = useCallback(
    (v: number) => onChange({ gridMultiplier: v }),
    [onChange],
  );
  const handleCollateralMultiplierChange = useCallback(
    (v: number) => onChange({ collateralMultiplier: v }),
    [onChange],
  );
  const handleTpPercentageChange = useCallback(
    (v: number) => onChange({ tpPercentage: v }),
    [onChange],
  );
  const handleTrailingModeChange = useCallback(
    (v: boolean) =>
      onChange({
        isTrailingMode: v,
        isActiveStopLoss: v ? true : legRef.current.isActiveStopLoss,
      }),
    [onChange],
  );
  const handleStopLossActiveChange = useCallback(
    (v: boolean) => onChange({ isActiveStopLoss: v }),
    [onChange],
  );
  const handleSlPercentageChange = useCallback(
    (v: number) => onChange({ slPercentage: v }),
    [onChange],
  );
  const handleSlippageChange = useCallback(
    (v: number) => onChange({ slippage: v }),
    [onChange],
  );
  const handleReEntranceChange = useCallback(
    (v: boolean) => onChange({ isReEntrance: v }),
    [onChange],
  );
  const handleReEntranceLimitChange = useCallback(
    (v: number) => onChange({ reEntranceLimit: v }),
    [onChange],
  );
  const handlePerpTradeGateChange = useCallback(() => { }, []);

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
        onClick={toggleExpanded}
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
              Direction{" "}
              {!isTrend && <span className="text-amber-400">(auto-synced)</span>}
            </label>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button
                type="button"
                onClick={handleLongClick}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${leg.isLong
                    ? "bg-emerald-500 text-white shadow"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                Long
              </button>
              <button
                type="button"
                onClick={handleShortClick}
                className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-all ${!leg.isLong
                    ? "bg-rose-500 text-white shadow"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  }`}
              >
                Short
              </button>
            </div>
          </div>

          {/* Initial Order Size */}
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
                onChange={handleInitialOrderSizeChange}
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

          {/* Entry */}
          {!isTrend ? (
            <div>
              <label
                className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-widest mb-1 ${accentColor}`}
              >
                <FiZap className="w-3 h-3" /> CT Algo Entry
                <InfoTooltip
                  id="ct-algo-entry-tooltip"
                  content="Counter-trend leg uses algorithmic indicators to decide when to enter and exit short-term positions."
                />
              </label>
              <TechnicalEntry
                technicalEntries={leg.technicalEntry}
                setTechnicalEntries={handleTechnicalEntryChange}
                title="CT Entry Conditions"
                isPerp={true}
                isAdvancedSymbol={isAdvancedSymbol}
              />
            </div>
          ) : (
            <EntryPriceRendering
              setEntryPrice={handleEntryPriceChange}
              label="Trend Entry Price"
              tooltipText="Price at which the trend (primary) position opens"
              tokenInfo={tokenInfo}
              currentPriceUsd={liveTokenPriceUsd}
            />
          )}

          {/* Grid config — trend only */}
          {isTrend && (
            <div className="p-3 bg-gray-100/70 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-widest">
                  Trend Grid Orders
                  <InfoTooltip
                    id="trend-grid-toggle-tooltip"
                    content="Split trend collateral across multiple grid entries with geometric collateral scaling"
                  />
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(leg.isGridEnabled)}
                    onChange={handleGridToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-violet-300 dark:peer-focus:ring-violet-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-violet-600"></div>
                </label>
              </div>

              {leg.isGridEnabled && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <GridInput
                      gridValue={leg.gridNumber ?? 2}
                      onChange={handleGridNumberChange}
                      user={user}
                      maxGridNumber={config?.maxGridNumber || 10}
                    />
                    <NumberInput
                      inputLabel="Grid Distance"
                      toolTipMessage="Percentage distance between each grid level"
                      value={leg.gridDistance ?? 10}
                      onChange={handleGridDistanceChange}
                      notValid={
                        leg.isGridEnabled &&
                        (!leg.gridDistance || leg.gridDistance <= 0)
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberInput
                      inputLabel="Grid Multiplier"
                      toolTipMessage="Multiplier for increasing grid distance at each level"
                      value={leg.gridMultiplier ?? 1}
                      onChange={handleGridMultiplierChange}
                      notValid={
                        leg.isGridEnabled &&
                        (!leg.gridMultiplier || leg.gridMultiplier <= 0)
                      }
                    />
                    <NumberInput
                      inputLabel="Collateral Multiplier"
                      toolTipMessage="Multiplier for increasing collateral at each grid level (e.g. 2 means 2x, 4x, etc.)"
                      value={leg.collateralMultiplier ?? 2}
                      onChange={handleCollateralMultiplierChange}
                      notValid={
                        leg.isGridEnabled &&
                        (!leg.collateralMultiplier ||
                          leg.collateralMultiplier <= 0)
                      }
                    />
                  </div>

                  <GridCollateralPreview
                    gridNumber={leg.gridNumber ?? 2}
                    gridDistance={leg.gridDistance ?? 10}
                    gridMultiplier={leg.gridMultiplier ?? 1}
                    collateralMultiplier={leg.collateralMultiplier ?? 2}
                    baseCollateral={Number(leg.initialOrderSize) || 0}
                    leverage={leg.leverage}
                    isLong={leg.isLong}
                    entryPrice={leg.entryPrice}
                    collateralSymbol={collateralToken?.symbol}
                  />
                </>
              )}
            </div>
          )}

          <TakeProfitInput
            takeProfitPercentage={leg.tpPercentage}
            onTakeProfitPercentageChange={handleTpPercentageChange}
            isTrailingMode={leg.isTrailingMode}
            handleTrailingMode={handleTrailingModeChange}
            initialOrderSize={leg.initialOrderSize}
            collateralToken={collateralToken}
            trailingMode={label === "Trend Order" ? false : true}
            additionalLabel={`${label === "Trend Order" ? "Net Hedge TP" : "TP"}`}
          />

          <StopLossInput
            isActive={leg.isActiveStopLoss}
            setIsActive={handleStopLossActiveChange}
            isTrailingMode={leg.isTrailingMode}
            stopLossPercentage={leg.slPercentage}
            setStopLossPercentage={handleSlPercentageChange}
            notValid={leg.isTrailingMode && leg.slPercentage === 0}
            additionalLabel={`${label === "Trend Order" ? "Net Hedge SL" : "SL"}`}
          />

          <SlippageInput slippage={leg.slippage} onChange={handleSlippageChange} />

          {label !== "Trend Order" && (
            <ReEntranceInput
              isReEntrance={leg.isReEntrance}
              setIsReEntrance={handleReEntranceChange}
              reEntranceLimit={leg.reEntranceLimit}
              setReEntranceLimit={handleReEntranceLimitChange}
            />
          )}

          {user?.account && (
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <label
                className={`text-xs font-semibold uppercase tracking-widest mb-2 block ${accentColor}`}
              >
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
                selectedStrategy={PAIR_TRADING_STRATEGY}
                estOrders={leg.estOrders}
                user={user}
                feeToken={isFeeExempt ? undefined : feeToken}
                onPerpTradeGateChange={handlePerpTradeGateChange}
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

  // ── Live price ref so buildLegOrderConfig stays stable ────────────
  const liveTokenPriceUsdRef = useRef(liveTokenPriceUsd);
  liveTokenPriceUsdRef.current = liveTokenPriceUsd;

  const [trendLeg, setTrendLeg] = useState<PairLegConfig>(() => createDefaultLeg(true));
  const [ctLeg, setCtLeg] = useState<PairLegConfig>(() => createDefaultLeg(false));

  const [totalCollateral, setTotalCollateral] = useState<string>("");
  const [trendLeverage, setTrendLeverage] = useState<number>(1);
  const [leverageRatio, setLeverageRatio] = useState<number>(5);

  // ── buildLegOrderConfig — stable (uses ref for live price) ────────
  const buildLegOrderConfig = useCallback(
    (leg: PairLegConfig, lev: number, orderLabel?: "trend" | "counterTrend") => {
      const currentPrice =
        liveTokenPriceUsdRef.current || tokenInfo?.priceUsd || "0";
      const targetPrice =
        leg.entryPrice && Number(leg.entryPrice) > 0
          ? leg.entryPrice
          : currentPrice;
      const isGrid =
        orderLabel === "trend" &&
        Boolean(leg.isGridEnabled) &&
        (leg.gridNumber || 1) > 1;

      return {
        gridNumber: isGrid ? leg.gridNumber || 1 : 1,
        targetPrice,
        activeStopLoss: leg.isActiveStopLoss,
        entryLogic:
          leg.technicalEntry && !(leg.technicalEntry as any).targetWeight
            ? leg.technicalEntry
            : null,
        entryWeight:
          leg.technicalEntry && (leg.technicalEntry as any).targetWeight
            ? leg.technicalEntry
            : null,
        entryType: leg.technicalEntry
          ? (leg.technicalEntry as any).targetWeight
            ? "weight"
            : "logic"
          : "price",
        mode: orderMode,
        orderSizeMultiplier: isGrid ? leg.collateralMultiplier || 1 : 1,
        initialOrderSize: leg.initialOrderSize || "0",
        gridMultiplier: isGrid ? leg.gridMultiplier || 1 : 1,
        gridDistance: isGrid ? leg.gridDistance || 10 : 10,
        collateralToken,
        outputToken: collateralToken,
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
    },
    [
      orderMode,
      collateralToken,
      tokenInfo,
      orderName,
      chainId,
      protocol,
      feeToken,
      isFeeExempt,
      user,
    ],
  );

  // ── Max leverage ──────────────────────────────────────────────────
  const maxLeverage = useMemo(() => {
    const parsed = Number(tokenInfo?.maxLeverage);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return Math.max(1, parsed);
  }, [tokenInfo?.maxLeverage]);

  useEffect(() => {
    if (trendLeverage > maxLeverage) setTrendLeverage(maxLeverage);
  }, [maxLeverage, trendLeverage]);

  // ── Sync margins & leverages ──────────────────────────────────────
  useEffect(() => {
    const collat = Number(totalCollateral) || 0;
    const ratio = leverageRatio || 1;

    const ctMargin = collat / (ratio + 1);
    const trendMargin = collat - ctMargin;

    const rawCtLev = trendLeverage * ratio;
    const ctLev = Math.min(rawCtLev, maxLeverage);

    const isGrid = Boolean(trendLeg.isGridEnabled) && (trendLeg.gridNumber ?? 2) > 1;
    let baseGridMargin = trendMargin;
    if (isGrid && trendMargin > 0) {
      const weightSum = calculateGridWeightsSum(
        trendLeg.gridNumber ?? 2,
        trendLeg.collateralMultiplier ?? 2,
      );
      baseGridMargin = trendMargin / weightSum;
    }

    const trendOrderSize = baseGridMargin > 0 ? baseGridMargin.toFixed(4) : "";
    const ctOrderSize = ctMargin > 0 ? ctMargin.toFixed(4) : "";

    setTrendLeg((prev) => {
      if (prev.leverage === trendLeverage && prev.initialOrderSize === trendOrderSize) {
        return prev; // ← bail-out: no unnecessary state update
      }
      return { ...prev, leverage: trendLeverage, initialOrderSize: trendOrderSize };
    });

    setCtLeg((prev) => {
      if (prev.leverage === ctLev && prev.initialOrderSize === ctOrderSize) {
        return prev;
      }
      return { ...prev, leverage: ctLev, initialOrderSize: ctOrderSize };
    });
  }, [
    totalCollateral,
    trendLeverage,
    leverageRatio,
    maxLeverage,
    trendLeg.isGridEnabled,
    trendLeg.gridNumber,
    trendLeg.collateralMultiplier,
  ]);

  // ── Seed entry price when token changes ───────────────────────────
  useEffect(() => {
    const p = liveTokenPriceUsdRef.current || tokenInfo?.priceUsd || "";
    if (!p) return;
    setTrendLeg((prev) => (prev.entryPrice ? prev : { ...prev, entryPrice: p }));
    setCtLeg((prev) => (prev.entryPrice ? prev : { ...prev, entryPrice: p }));
  }, [tokenInfo?.address, tokenInfo?.priceUsd]);

  const patchTrend = useCallback(
    (patch: Partial<PairLegConfig>) => setTrendLeg((prev) => ({ ...prev, ...patch })),
    [],
  );
  const patchCt = useCallback(
    (patch: Partial<PairLegConfig>) => setCtLeg((prev) => ({ ...prev, ...patch })),
    [],
  );

  // ── Keep CT direction opposite to trend direction ─────────────────
  const prevTrendIsLong = useRef(trendLeg.isLong);
  useEffect(() => {
    if (prevTrendIsLong.current !== trendLeg.isLong) {
      prevTrendIsLong.current = trendLeg.isLong;
      setCtLeg((prev) => ({ ...prev, isLong: !trendLeg.isLong }));
    }
  }, [trendLeg.isLong]);

  // ── Validation ────────────────────────────────────────────────────
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

    if (trendLeg.isGridEnabled) {
      const gridNum = trendLeg.gridNumber ?? 2;
      const gridDist = trendLeg.gridDistance ?? 10;
      const gridMult = trendLeg.gridMultiplier ?? 1;
      const colMult = trendLeg.collateralMultiplier ?? 2;

      if (gridNum < 2)
        return {
          isReady: false,
          notReadyReason: "Grid number must be ≥ 2 when grid is enabled",
        };
      if (gridDist <= 0)
        return { isReady: false, notReadyReason: "Grid distance must be > 0" };
      if (gridMult <= 0)
        return { isReady: false, notReadyReason: "Grid multiplier must be > 0" };
      if (colMult <= 0)
        return {
          isReady: false,
          notReadyReason: "Collateral multiplier must be > 0",
        };

      if (isNegativeGridDrop(trendLeg.isLong, gridDist, gridNum, gridMult)) {
        return { isReady: false, notReadyReason: "Grid price cannot be 0 or negative" };
      }

      const minCollateral = Number(trendLeg.initialOrderSize) || 0;
      if (config?.minimumOrderSize && minCollateral < config.minimumOrderSize) {
        return {
          isReady: false,
          notReadyReason: `Smallest grid order (${minCollateral.toFixed(2)} ${collateralToken?.symbol || ""
            }) is below minimum (${config.minimumOrderSize})`,
        };
      }
    }

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
      return {
        isReady: false,
        notReadyReason: `Trend leverage (${trendLeg.leverage}x) exceeds max allowed (${maxLeverage}x)`,
      };
    if (ctLeg.leverage > maxLeverage)
      return {
        isReady: false,
        notReadyReason: `CT leverage (${ctLeg.leverage}x) exceeds max allowed (${maxLeverage}x)`,
      };

    if (!trendLeg.areWalletsReady)
      return { isReady: false, notReadyReason: "Select trend wallet" };
    if (!ctLeg.areWalletsReady)
      return { isReady: false, notReadyReason: "Select CT wallet" };

    const trendWalletId = Object.values(trendLeg.gridsByWallet)?.[0]?._id;
    const ctWalletId = Object.values(ctLeg.gridsByWallet)?.[0]?._id;
    if (trendWalletId && ctWalletId && trendWalletId === ctWalletId)
      return {
        isReady: false,
        notReadyReason: "Trend & CT wallets must be different",
      };

    if (trendLeg.isLong === ctLeg.isLong)
      return { isReady: false, notReadyReason: "Legs must have opposite directions" };

    if (!isConnected)
      return { isReady: false, notReadyReason: "Connect your wallet" };

    return { isReady: true, notReadyReason: "" };
  }, [
    orderName,
    trendLeg,
    ctLeg,
    isConnected,
    maxLeverage,
    config?.minimumOrderSize,
    collateralToken?.symbol,
  ]);

  // ── Propagate config to parent ────────────────────────────────────
  const onConfigChangeRef = useRef(onConfigChange);
  onConfigChangeRef.current = onConfigChange;

  useEffect(() => {
    onConfigChangeRef.current(
      { trend: trendLeg, counterTrend: ctLeg, sharedOrderName: orderName, orderMode },
      isReady,
    );
  }, [trendLeg, ctLeg, orderName, orderMode, isReady]);

  // ── Regenerate estOrders + notify parent only on change ───────────
  const setEstOrdersRef = useRef(setEstOrders);
  setEstOrdersRef.current = setEstOrders;

  const trendEstOrdersRef = useRef<OrderType[]>([]);
  const ctEstOrdersRef = useRef<OrderType[]>([]);

  useEffect(() => {
    try {
      const currentPrice =
        liveTokenPriceUsdRef.current || tokenInfo?.priceUsd || "0";
      const trendPrice = trendLeg.entryPrice || currentPrice;
      const ctPrice = ctLeg.entryPrice || currentPrice;

      const hasTrendSize = Number(trendLeg.initialOrderSize) > 0;
      const hasCtSize = Number(ctLeg.initialOrderSize) > 0;

      const trendEst =
        hasTrendSize && Number(trendPrice) > 0
          ? configurePerpOrderRef.current(
            buildLegOrderConfig(
              { ...trendLeg, entryPrice: trendPrice },
              trendLeg.leverage,
              "trend",
            ),
          )
          : [];
      const ctEst =
        hasCtSize && (ctLeg.technicalEntry || Number(ctPrice) > 0)
          ? configurePerpOrderRef.current(
            buildLegOrderConfig(
              { ...ctLeg, entryPrice: ctPrice },
              ctLeg.leverage,
              "counterTrend",
            ),
          )
          : [];

      const trendChanged = !areOrderListsEqual(trendEstOrdersRef.current, trendEst);
      const ctChanged = !areOrderListsEqual(ctEstOrdersRef.current, ctEst);

      if (trendChanged) {
        trendEstOrdersRef.current = trendEst;
        setTrendLeg((prev) => ({ ...prev, estOrders: trendEst }));
      }
      if (ctChanged) {
        ctEstOrdersRef.current = ctEst;
        setCtLeg((prev) => ({ ...prev, estOrders: ctEst }));
      }
      if (trendChanged || ctChanged) {
        setEstOrdersRef.current([...trendEst, ...ctEst]);
      }
    } catch (e) {
      console.warn("PairTrading estOrders generation error:", e);
    }
  }, [
    trendLeg.initialOrderSize,
    trendLeg.entryPrice,
    trendLeg.isLong,
    trendLeg.leverage,
    trendLeg.tpPercentage,
    trendLeg.slPercentage,
    trendLeg.isTrailingMode,
    trendLeg.slippage,
    trendLeg.technicalEntry,
    trendLeg.isGridEnabled,
    trendLeg.gridNumber,
    trendLeg.gridDistance,
    trendLeg.gridMultiplier,
    trendLeg.collateralMultiplier,
    ctLeg.initialOrderSize,
    ctLeg.entryPrice,
    ctLeg.isLong,
    ctLeg.leverage,
    ctLeg.tpPercentage,
    ctLeg.slPercentage,
    ctLeg.isTrailingMode,
    ctLeg.slippage,
    ctLeg.technicalEntry,
    buildLegOrderConfig,
    tokenInfo?.priceUsd,
  ]);

  const trendSelectedWalletId = trendLeg.gridsByWallet?.[1]?._id;
  const ctSelectedWalletId = ctLeg.gridsByWallet?.[1]?._id;

  const trendAvailableWallets = useMemo(() => {
    if (!ctSelectedWalletId) return userWallets;
    return userWallets.filter((w) => w._id !== ctSelectedWalletId);
  }, [userWallets, ctSelectedWalletId]);

  const ctAvailableWallets = useMemo(() => {
    if (!trendSelectedWalletId) return userWallets;
    return userWallets.filter((w) => w._id !== trendSelectedWalletId);
  }, [userWallets, trendSelectedWalletId]);

  // ── Split-info values for the summary card ────────────────────────
  const trendSplit = useMemo(() => {
    const isGrid = Boolean(trendLeg.isGridEnabled) && (trendLeg.gridNumber || 1) > 1;
    const base = Number(trendLeg.initialOrderSize) || 0;
    if (isGrid) {
      const { totalCollateral } = computePairGridPrices({
        entryPriceStr: trendLeg.entryPrice,
        gridNumber: trendLeg.gridNumber ?? 2,
        gridDistance: trendLeg.gridDistance ?? 10,
        gridMultiplier: trendLeg.gridMultiplier ?? 1,
        collateralMultiplier: trendLeg.collateralMultiplier ?? 2,
        baseCollateral: base,
        leverage: trendLeg.leverage,
        isLong: trendLeg.isLong,
      });
      return { isGrid: true, total: totalCollateral, base };
    }
    return { isGrid: false, total: base, base };
  }, [
    trendLeg.isGridEnabled,
    trendLeg.gridNumber,
    trendLeg.gridDistance,
    trendLeg.gridMultiplier,
    trendLeg.collateralMultiplier,
    trendLeg.initialOrderSize,
    trendLeg.entryPrice,
    trendLeg.leverage,
    trendLeg.isLong,
  ]);

  return (
    <div className="space-y-3">
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

      <div className="bg-gray-50 dark:bg-gray-900 p-3 2xl:p-4 rounded-xl border border-gray-100 dark:border-gray-800 space-y-4">
        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          Pair Configuration (Auto-Split)
        </h4>

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

        <div className="grid gap-4">
          <div>
            <LeverageInput
              leverage={trendLeverage}
              onLeverageChange={(v) => setTrendLeverage(Math.min(v, maxLeverage))}
              maxLeverage={maxLeverage}
            />
          </div>

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

        {Number(totalCollateral) > 0 && (
          <div className="flex gap-2 text-xs font-medium mt-2">
            <div className="flex-1 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 p-2 rounded-lg border border-violet-200 dark:border-violet-700/40">
              <span className="opacity-80">Trend Leg:</span> <br />
              {trendSplit.isGrid ? (
                <>
                  <span className="font-semibold">
                    {trendSplit.total.toFixed(2)} {collateralToken?.symbol}
                  </span>{" "}
                  @ {trendLeg.leverage}x
                  <div className="text-[10px] opacity-80 mt-0.5">
                    ({trendLeg.gridNumber} grids: base {trendSplit.base.toFixed(2)}{" "}
                    {collateralToken?.symbol}, {trendLeg.collateralMultiplier}x mult)
                  </div>
                </>
              ) : (
                <>
                  {trendSplit.total.toFixed(2)} {collateralToken?.symbol} @{" "}
                  {trendLeg.leverage}x
                </>
              )}
            </div>
            <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 p-2 rounded-lg border border-amber-200 dark:border-amber-700/40">
              <span className="opacity-80">CT Leg:</span> <br />
              {Number(ctLeg.initialOrderSize).toFixed(2)} {collateralToken?.symbol} @{" "}
              {ctLeg.leverage}x
              {trendLeg.isGridEnabled && (trendLeg.gridNumber || 1) > 1 && (
                <div className="text-[10px] opacity-80 mt-0.5">
                  (runtime size matches trend #1 position)
                </div>
              )}
              {trendLeverage * leverageRatio > maxLeverage && (
                <span className="ml-1 text-red-500 dark:text-red-400 font-semibold">
                  (capped at {maxLeverage}x)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

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

      {!isReady && notReadyReason && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 text-xs text-amber-700 dark:text-amber-300">
          <FiAlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {notReadyReason}
        </div>
      )}

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