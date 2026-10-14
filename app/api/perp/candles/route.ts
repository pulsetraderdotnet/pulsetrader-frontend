import { NextResponse } from "next/server";
import { getHyperLiquidCandles } from "@/lib/oracle/hyperliquid";

// Map interval string to duration in ms for timeframe calculation
const INTERVAL_DURATION_MS: Record<string, number> = {
  "1m": 60 * 1000,
  "3m": 3 * 60 * 1000,
  "5m": 5 * 60 * 1000,
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "2h": 2 * 60 * 60 * 1000,
  "4h": 4 * 60 * 60 * 1000,
  "8h": 8 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");
    const intervalsParam = searchParams.get("intervals") || "1m";

    if (!symbol) {
      return NextResponse.json(
        { success: false, error: "Missing symbol parameter" },
        { status: 400 }
      );
    }

    const intervals = intervalsParam
      .split(",")
      .map((i) => i.trim())
      .filter(Boolean);

    const now = Math.floor(Date.now() / 1000);
    const candleLimit = 100; // Enough for accurate Wilder RSI smoothing (period 14)

    const data: Record<string, any[]> = {};

    await Promise.all(
      intervals.map(async (interval) => {
        const durationSec = ((INTERVAL_DURATION_MS[interval] || 60000) / 1000) * candleLimit;
        const from = now - durationSec;
        const to = now;

        try {
          const candles = await getHyperLiquidCandles({
            symbol,
            resolution: interval,
            from,
            to,
            limit: candleLimit,
          });

          if (Array.isArray(candles)) {
            data[interval] = candles;
          } else {
            data[interval] = [];
          }
        } catch {
          data[interval] = [];
        }
      })
    );

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to fetch candles" },
      { status: 500 }
    );
  }
}
