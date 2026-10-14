"use client";
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";

// Domain & Store
import DataFeed from "@/domain/datafeed/hyperliquidDatafeed";
import { useChartDataStore } from "@/store/useChartData";
import { useShallow } from "zustand/shallow";
import {
  getDynamicChartOverrides,
  enabledFeatures,
  PlatformResolutionToChartResolution,
} from "@/constants/common/chart";

// Helpers
import {
  drawOrderLinesWithMode,
  clearOrderLines,
  applyIndicatorStudy,
  collectRSITimeframes,
} from "../../chartViewHelper.js";

// ─── Client-side candle fetcher ────────────────────────────────────────
// Replace the URL with your own API endpoint that returns
// { success: true, data: { "1m": [...], "5m": [...] } }
async function fetchCandlesForTimeframes(symbol, timeframes) {
  if (!symbol || !timeframes?.length) return {};
  try {
    const params = new URLSearchParams({
      symbol,
      intervals: timeframes.join(","),
    });
    const res = await fetch(`/api/perp/candles?${params.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return {};
    const json = await res.json();
    return json?.data || {};
  } catch {
    return {};
  }
}

// ─── Theme helper ──────────────────────────────────────────────────────
const getTheme = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return localStorage.getItem("theme") || "dark";
  }
  return "dark";
};

const TradingViewHyperliquidChart = React.memo(({ symbol }) => {
  // ─── State & Refs ──────────────────────────────────────────────────
  const [chartReady, setChartReady] = useState(false);
  const chartContainerRef = useRef(null);
  const tvWidgetRef = useRef(null);

  const linesRef = useRef([]);
  const studyRef = useRef(null);

  // Candle cache for RSI lines
  const [candleMap, setCandleMap] = useState({});
  const candleFetchKeyRef = useRef(""); // `${symbol}|${timeframeKey}`

  // ─── Store ─────────────────────────────────────────────────────────
  const { ordersOnChart, indicatorOnChart, marketSnapshotRef } =
    useChartDataStore(
      useShallow((state) => ({
        ordersOnChart: state.ordersOnChart,
        indicatorOnChart: state.indicatorOnChart,
        marketSnapshotRef: state.marketSnapshotRef,
      })),
    );

  // ─── Which timeframes do current orders need? ──────────────────────
  const requiredTimeframes = useMemo(
    () => collectRSITimeframes(ordersOnChart),
    [ordersOnChart],
  );
  const timeframeKey = requiredTimeframes.join(",");

  // ─── Live price for real-time RSI lines ────────────────────────────
  const livePrice = useMemo(() => {
    const p = marketSnapshotRef?.current?.priceUsd;
    const n = p != null ? parseFloat(p) : NaN;
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [marketSnapshotRef]);

  // ─── Fetch candles when symbol or timeframes change ────────────────
  useEffect(() => {
    if (!symbol || requiredTimeframes.length === 0) {
      setCandleMap({});
      candleFetchKeyRef.current = "";
      return;
    }

    const key = `${symbol}|${timeframeKey}`;
    if (candleFetchKeyRef.current === key) return;

    let cancelled = false;
    (async () => {
      const map = await fetchCandlesForTimeframes(symbol, requiredTimeframes);
      if (cancelled) return;
      setCandleMap(map);
      candleFetchKeyRef.current = key;
    })();

    return () => {
      cancelled = true;
    };
  }, [symbol, timeframeKey, requiredTimeframes]);

  // ─── Draw all lines (TP/SL/LIQ + reverse-RSI) ──────────────────────
  const drawLineOnChart = useCallback(() => {
    if (!chartReady || !tvWidgetRef.current) return;
    try {
      const chart = tvWidgetRef.current.activeChart();
      if (!chart) return;

      clearOrderLines(chart, linesRef.current);
      linesRef.current = drawOrderLinesWithMode(
        chart,
        ordersOnChart,
        "all",
        null,
        candleMap,       // ← enables RSI lines
        livePrice,       // ← makes RSI lines follow live price
      );
    } catch (_) {
      /* widget not ready */
    }
  }, [chartReady, ordersOnChart, candleMap, livePrice]);

  // ─── Update indicator study ────────────────────────────────────────
  const updateIndicatorOnChart = useCallback(() => {
    if (!tvWidgetRef.current) return;
    const chart = tvWidgetRef.current.activeChart();

    if (studyRef.current) {
      try {
        chart.removeEntity(studyRef.current);
      } catch {
        /* ignore */
      }
      studyRef.current = null;
    }

    studyRef.current = applyIndicatorStudy(
      tvWidgetRef.current,
      indicatorOnChart,
      PlatformResolutionToChartResolution,
    );
  }, [indicatorOnChart]);

  // ─── Effect: order lines (redraws on any relevant change) ──────────
  useEffect(() => {
    if (chartReady && tvWidgetRef.current && ordersOnChart?.length > 0) {
      drawLineOnChart();
    }

    return () => {
      if (tvWidgetRef.current) {
        try {
          const chart = tvWidgetRef.current.activeChart();
          if (chart) clearOrderLines(chart, linesRef.current);
        } catch {
          /* ignore */
        }
      }
      linesRef.current = [];
    };
  }, [chartReady, ordersOnChart, candleMap, livePrice, drawLineOnChart]);

  // ─── Effect: indicators ────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady) return;
    const timeoutId = setTimeout(updateIndicatorOnChart, 100);

    return () => {
      clearTimeout(timeoutId);
      if (tvWidgetRef.current && studyRef.current) {
        try {
          const chart = tvWidgetRef.current.activeChart();
          if (chart) chart.removeEntity(studyRef.current);
        } catch {
          /* ignore */
        }
        studyRef.current = null;
      }
    };
  }, [chartReady, indicatorOnChart, updateIndicatorOnChart]);

  // ─── Effect: initialize widget ─────────────────────────────────────
  useEffect(() => {
    const scriptId = "tradingview-widget-script";
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "/charting_library/charting_library.js";
    script.async = true;

    const initWidget = () => {
      if (window.TradingView && chartContainerRef.current) {
        const dataFeed = new DataFeed(symbol);
        const currentTheme = getTheme();
        const dynamicOverrides = getDynamicChartOverrides(currentTheme);

        const widgetOptions = {
          container: chartContainerRef.current,
          datafeed: dataFeed,
          library_path: "/charting_library/",
          autosize: true,
          symbol,
          interval: "1D",
          timezone: "Etc/UTC",
          theme: currentTheme,
          style: "1",
          locale: "en",
          enable_publishing: false,
          allow_symbol_change: false,
          overrides: dynamicOverrides,
          save_image: false,
          studies: [],
          disabled_features: ["header_symbol_search", "header_compare"],
          custom_css_url: "/tradingview-chart.css",
          enabled_features: enabledFeatures,
        };

        const widget = new window.TradingView.widget(widgetOptions);
        tvWidgetRef.current = widget;

        widget.onChartReady(() => setChartReady(true));
      }
    };

    script.onload = initWidget;
    document.body.appendChild(script);

    return () => {
      if (tvWidgetRef.current) {
        try {
          tvWidgetRef.current.remove();
        } catch (e) {
          console.warn("Error removing widget", e);
        }
        tvWidgetRef.current = null;
        setChartReady(false);
      }
      const existingScript = document.getElementById(scriptId);
      if (existingScript) existingScript.remove();
    };
  }, [symbol]);

  // ─── Effect: theme switcher ────────────────────────────────────────
  useEffect(() => {
    const handleThemeChange = () => {
      if (tvWidgetRef.current && chartReady) {
        const newTheme = getTheme();
        tvWidgetRef.current.changeTheme(newTheme);
        const dynamicOverrides = getDynamicChartOverrides(newTheme);
        tvWidgetRef.current.activeChart().applyOverrides(dynamicOverrides);
      }
    };

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") handleThemeChange();
      });
    });

    if (typeof window !== "undefined") {
      observer.observe(document.documentElement, { attributes: true });
    }
    return () => observer.disconnect();
  }, [chartReady]);

  return (
    <div
      id="tradingview_advanced_chart"
      ref={chartContainerRef}
      style={{
        height: "100%",
        width: "100%",
        borderRadius: "10px",
        overflow: "hidden",
      }}
    />
  );
});

TradingViewHyperliquidChart.displayName = "TradingViewHyperliquidChart";
export default TradingViewHyperliquidChart;