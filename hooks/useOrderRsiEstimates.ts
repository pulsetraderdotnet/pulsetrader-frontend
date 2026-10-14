import { useEffect, useState, useMemo, useRef } from "react";
import {
  reverseRSI,
  extractRSIConditions,
  type RSICondition,
} from "@/lib/reverseIndictaor";
import { normalizeCoin } from "@/utility/perpUtils";
import { getHyperLiquidCandles } from "@/lib/oracle/hyperliquid";

export interface RsiEstimateItem {
  targetRSI: number;
  operator: string;
  timeframe: string;
  period: number;
  targetPrice: number | null;
  currentRSI: number;
  referencePrice: number;
  up: number | null;
  down: number | null;
}

// In-memory cache shared across all OrderCard instances to prevent redundant network fetches
const globalCandleCache = new Map<string, { candles: any[]; fetchedAt: number }>();
const CACHE_TTL_MS = 15_000; // 15 seconds

async function fetchCandlesForTimeframe(symbol: string, timeframe: string): Promise<any[]> {
  const cacheKey = `${symbol}:${timeframe}`;
  const cached = globalCandleCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.candles;
  }

  try {
    // Try API route first
    const res = await fetch(`/api/perp/candles?symbol=${symbol}&intervals=${timeframe}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const json = await res.json();
      const list = json?.data?.[timeframe];
      if (Array.isArray(list) && list.length > 0) {
        globalCandleCache.set(cacheKey, { candles: list, fetchedAt: Date.now() });
        return list;
      }
    }
  } catch {
    // Fall back to direct Hyperliquid fetch if API route is unavailable
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - 60000; // will be scaled inside getHyperLiquidCandles
    const list = await getHyperLiquidCandles({
      symbol,
      resolution: timeframe,
      from,
      to: now,
      limit: 100,
    });
    if (Array.isArray(list) && list.length > 0) {
      globalCandleCache.set(cacheKey, { candles: list, fetchedAt: Date.now() });
      return list;
    }
  } catch {
    // Ignore error
  }

  return [];
}

export function useOrderRsiEstimates(
  order: any,
  livePrice?: number | string | null
): RsiEstimateItem[] {
  const [candleMap, setCandleMap] = useState<Record<string, any[]>>({});
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Extract all RSI conditions from technicalLogic and technicalWeights
  const rsiConditions = useMemo<RSICondition[]>(() => {
    return extractRSIConditions(order);
  }, [order?.entry?.technicalLogic, order?.entry?.technicalWeights]);

  const symbol = useMemo(() => {
    const raw =
      order?.orderAsset?.orderToken?.symbol ||
      order?.orderAsset?.perpSymbolInfo ||
      order?.indexTokenAddress ||
      "";
    return normalizeCoin(raw);
  }, [order?.orderAsset, order?.indexTokenAddress]);

  const requiredTimeframes = useMemo(() => {
    return [...new Set(rsiConditions.map((c) => c.timeframe || "1m"))];
  }, [rsiConditions]);

  const timeframesKey = requiredTimeframes.join(",");

  useEffect(() => {
    if (!symbol || requiredTimeframes.length === 0) {
      setCandleMap({});
      return;
    }

    let isCancelled = false;

    const loadCandles = async () => {
      const nextMap: Record<string, any[]> = {};
      await Promise.all(
        requiredTimeframes.map(async (tf) => {
          const list = await fetchCandlesForTimeframe(symbol, tf);
          if (list && list.length > 0) {
            nextMap[tf] = list;
          }
        })
      );

      if (!isCancelled && isMountedRef.current) {
        setCandleMap((prev) => ({ ...prev, ...nextMap }));
      }
    };

    loadCandles();
    const intervalId = setInterval(loadCandles, 10_000);

    return () => {
      isCancelled = true;
      clearInterval(intervalId);
    };
  }, [symbol, timeframesKey, requiredTimeframes]);

  // Compute Reverse RSI estimates for each condition
  const estimates = useMemo<RsiEstimateItem[]>(() => {
    if (rsiConditions.length === 0) return [];

    const liveNum = livePrice != null ? parseFloat(String(livePrice)) : NaN;
    const validLive = Number.isFinite(liveNum) && liveNum > 0 ? liveNum : null;

    const list: RsiEstimateItem[] = [];

    for (const cond of rsiConditions) {
      const candles = candleMap[cond.timeframe];
      if (!candles || candles.length < cond.period + 1) continue;

      const closes = candles.map((c: any) => Number(c.close));
      if (validLive && closes.length > 0) {
        closes[closes.length - 1] = validLive;
      }

      try {
        const solved = reverseRSI(closes, cond.targetRSI, { period: cond.period });
        list.push({
          targetRSI: cond.targetRSI,
          operator: cond.operator,
          timeframe: cond.timeframe,
          period: cond.period,
          targetPrice: solved.valid,
          currentRSI: solved.currentRSI,
          referencePrice: solved.referencePrice,
          up: solved.up,
          down: solved.down,
        });
      } catch {
        // Ignore math exception
      }
    }

    return list;
  }, [rsiConditions, candleMap, livePrice]);

  return estimates;
}
