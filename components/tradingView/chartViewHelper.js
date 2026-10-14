import { formatUnits } from "ethers";
import { PRECISION_DECIMALS } from "@/constants/common/utils";
import { reverseRSIMultiple } from "@/lib/reverseIndictaor";

// ─── Existing line styles ──────────────────────────────────────────────
const LINE_STYLE = {
  TP: { linecolor: "#05aa58", textcolor: "#05aa58" },
  SL: { linecolor: "#aa0573", textcolor: "#aa0573" },
  LIQ: { linecolor: "#a7a605", textcolor: "#a7a605" },
  ENTRY: { linecolor: "#e0d5d5", textcolor: "#e0d5d5" },
  BUY: { color: "#00ff00" },
  SELL: { color: "#ff0000" },
};

const RSI_STYLE = {
  OVERBOUGHT: { linecolor: "#f59e0b", textcolor: "#f59e0b" }, // amber
  OVERSOLD: { linecolor: "#06b6d4", textcolor: "#06b6d4" },   // cyan
};

const BASE_OVERRIDES = {
  linewidth: 2,
  linestyle: 0,
  showLabel: true,
  horzLabelsAlign: "right",
  vertLabelsAlign: "bottom",
  bold: true,
  fontsize: 12,
  showPrice: true,
};

// ─── Shape helpers ─────────────────────────────────────────────────────

function addHorizontalLine(chart, price, text, kind) {
  return chart.createShape(
    { time: Math.floor(Date.now() / 1000), price },
    {
      shape: "horizontal_line",
      text,
      lock: true,
      disableSelection: true,
      disableSave: true,
      disableUndo: true,
      overrides: { ...BASE_OVERRIDES, ...LINE_STYLE[kind] },
    },
  );
}

function addTickerOnChart(chart, price, unixTime, text, kind) {
  return chart.createShape(
    { time: unixTime, price },
    {
      shape: kind === "BUY" ? "arrow_up" : "arrow_down",
      text,
      lock: true,
      disableSelection: true,
      disableSave: true,
      disableUndo: true,
      overrides: {
        ...BASE_OVERRIDES,
        color: LINE_STYLE[kind]?.color || (kind === "BUY" ? "#00ff00" : "#ff0000"),
        fontsize: 10,
        showPrice: true,
      },
    },
  );
}

// Dashed horizontal line for reverse-RSI estimated price
function addRSILine(chart, price, text, kind) {
  return chart.createShape(
    { time: Math.floor(Date.now() / 1000), price },
    {
      shape: "horizontal_line",
      text,
      lock: true,
      disableSelection: true,
      disableSave: true,
      disableUndo: true,
      overrides: {
        ...BASE_OVERRIDES,
        linestyle: 2, // dashed so it's visually distinct from TP/SL
        linewidth: 1,
        fontsize: 10,
        ...(RSI_STYLE[kind] || RSI_STYLE.OVERSOLD),
      },
    },
  );
}

// ─── RSI extraction ────────────────────────────────────────────────────

/**
 * Walk an order's technical entry config and return all RSI conditions.
 * @returns {{targetRSI:number, operator:string, timeframe:string, period:number, source:string}[]}
 */
export function extractRSIConditions(order) {
  const conditions = [];

  const walk = (node, source) => {
    if (!node) return;

    // Leaf condition — { metric: "rsi", value: "30", ... }
    const metric = node.metric || node.metrics;
    if (metric === "rsi" && node.value != null) {
      const target = parseFloat(node.value);
      if (Number.isFinite(target) && target > 0 && target < 100) {
        conditions.push({
          targetRSI: target,
          operator: node.operator || "GREATER_THAN",
          timeframe: node.timeframe || "1m",
          period: parseInt(node.period) || 14,
          source,
        });
      }
    }

    // Group node — recurse into logic[] and weights[]
    if (Array.isArray(node.logic)) {
      node.logic.forEach((child) => walk(child, source));
    }
    if (Array.isArray(node.weights)) {
      node.weights.forEach((child) => walk(child, source));
    }
  };

  walk(order?.entry?.technicalLogic, "entry_logic");
  walk(order?.entry?.technicalWeights, "entry_weight");

  return conditions;
}

/**
 * Collect the set of unique timeframes referenced by RSI conditions across orders.
 */
export function collectRSITimeframes(orders) {
  const tfs = new Set();
  for (const order of orders || []) {
    for (const cond of extractRSIConditions(order)) {
      tfs.add(cond.timeframe);
    }
  }
  return [...tfs];
}

// ─── RSI line drawing ──────────────────────────────────────────────────

/**
 * Draw RSI-derived price lines.
 *
 * @param {object} chart        TradingView chart instance
 * @param {object} candleMap    { [timeframe]: candle[] }
 * @param {Array}  conditions   [{ targetRSI, timeframe, period, source }]
 * @param {string} labelPrefix  e.g. "MyOrder/1_"
 * @param {number} [livePrice]  optional current price (substitutes last close)
 */
export function drawRSILines(
  chart,
  candleMap,
  conditions,
  labelPrefix = "",
  livePrice = null,
) {
  const ids = [];
  if (!chart || !candleMap || !conditions?.length) return ids;

  // Group by (timeframe, period) so we do ONE Wilder pass per group
  const grouped = new Map();
  for (const cond of conditions) {
    const tf = cond.timeframe || "1m";
    const period = cond.period || 14;
    const key = `${tf}:${period}`;
    if (!grouped.has(key)) grouped.set(key, { tf, period, items: [] });
    grouped.get(key).items.push(cond);
  }

  for (const { tf, period, items } of grouped.values()) {
    const candles = candleMap[tf];
    if (!candles || candles.length < period + 1) continue;

    const closes = candles.map((c) => c.close);
    // Substitute latest close with live price if provided
    if (livePrice && closes.length > 0) {
      closes[closes.length - 1] = livePrice;
    }

    const targets = items.map((i) => i.targetRSI);
    const solved = reverseRSIMultiple(closes, targets, { period });

    for (const cond of items) {
      const result = solved.get(cond.targetRSI);
      if (!result || result.valid == null || !Number.isFinite(result.valid)) {
        continue;
      }

      const kind = cond.targetRSI >= 50 ? "OVERBOUGHT" : "OVERSOLD";
      const label = `${labelPrefix}RSI-${cond.targetRSI}${tf !== "1m" ? `@${tf}` : ""
        }`;

      ids.push(addRSILine(chart, result.valid, label, kind));
    }
  }

  return ids;
}

// ─── Main entry: draw everything ───────────────────────────────────────

/**
 * @param {object}  chart
 * @param {Array}   orders
 * @param {string}  mode               'all' | 'pending' | 'opened' | 'closed' | 'single'
 * @param {string}  singleOrderId
 * @param {object}  candleMap          { [timeframe]: candle[] } — enables RSI lines
 * @param {number}  livePrice          current market price (for live-RSI)
 */
export function drawOrderLinesWithMode(
  chart,
  orders,
  mode = "all",
  singleOrderId = null,
  candleMap = null,
  livePrice = null,
) {
  const ids = [];
  if (!chart || !orders || orders.length === 0) return ids;

  let filteredOrders = [];

  switch (mode) {
    case "all":
      filteredOrders = orders;
      break;
    case "pending":
      filteredOrders = orders.filter(
        (o) => o.orderStatus === "PENDING" && o.orderType === "BUY",
      );
      break;
    case "opened":
      filteredOrders = orders.filter(
        (o) => o.orderStatus === "OPENED" && o.orderType === "SELL",
      );
      break;
    case "closed":
      filteredOrders = orders.filter((o) => o.orderStatus === "CLOSED");
      break;
    case "single":
      filteredOrders = orders.filter((o) => o._id === singleOrderId);
      break;
    default:
      filteredOrders = orders;
  }

  filteredOrders.forEach((order) => {
    // ─── Entry ticker ──────────────────────────────────────────────
    if (
      order.executionDetails?.entryAt &&
      order.executionDetails?.entryPriceUsd &&
      parseFloat(order.executionDetails.entryPriceUsd) !== 0
    ) {
      const entryPrice = formatUnits(
        BigInt(order.executionDetails.entryPriceUsd),
        PRECISION_DECIMALS,
      );
      const entryTime = Math.floor(
        parseFloat(order.executionDetails.entryAt) / 1000,
      );
      ids.push(
        addTickerOnChart(
          chart,
          Number(entryPrice),
          entryTime,
          `${order.name}/${order.sl}_ENTRY`,
          "BUY",
        ),
      );
    }

    // ─── Exit ticker ───────────────────────────────────────────────
    if (
      order.executionDetails?.exitAt &&
      order.executionDetails?.exitPriceUsd &&
      parseFloat(order.executionDetails.exitPriceUsd) !== 0
    ) {
      const exitPrice = formatUnits(
        BigInt(order.executionDetails.exitPriceUsd),
        PRECISION_DECIMALS,
      );
      const exitTime = Math.floor(
        parseFloat(order.executionDetails.exitAt) / 1000,
      );
      ids.push(
        addTickerOnChart(
          chart,
          Number(exitPrice),
          exitTime,
          `${order.name}/${order.sl}_EXIT`,
          "SELL",
        ),
      );
    }

    // ─── OPENED: TP / SL / LIQ ─────────────────────────────────────
    if (order.orderStatus === "OPENED" && order.orderType === "SELL") {
      if (
        order.exit.takeProfit?.takeProfitPrice &&
        parseFloat(order.exit.takeProfit.takeProfitPrice) !== 0
      ) {
        const tpPrice = formatUnits(
          BigInt(order.exit.takeProfit.takeProfitPrice),
          PRECISION_DECIMALS,
        );
        ids.push(
          addHorizontalLine(
            chart,
            Number(tpPrice),
            `${order.name}/${order.sl}_TP`,
            "TP",
          ),
        );
      }
      if (
        order.exit.stopLoss?.stopLossPrice &&
        parseFloat(order.exit.stopLoss.stopLossPrice) !== 0
      ) {
        const slPrice = formatUnits(
          BigInt(order.exit.stopLoss.stopLossPrice),
          PRECISION_DECIMALS,
        );
        ids.push(
          addHorizontalLine(
            chart,
            Number(slPrice),
            `${order.name}/${order.sl}_SL`,
            "SL",
          ),
        );
      }
      if (
        order.category === "perpetual" &&
        order.executionDetails?.liquidationPriceUsd &&
        parseFloat(order.executionDetails.liquidationPriceUsd) !== 0
      ) {
        const liqPrice = formatUnits(
          BigInt(order.executionDetails.liquidationPriceUsd),
          PRECISION_DECIMALS,
        );
        ids.push(
          addHorizontalLine(
            chart,
            Number(liqPrice),
            `${order.name}/${order.sl}_LIQ`,
            "LIQ",
          ),
        );
      }
    }

    // ─── PENDING BUY: entry line (price-based) ─────────────────────
    if (
      order.orderStatus === "PENDING" &&
      order.orderType === "BUY" &&
      !order.entry?.isTechnicalEntry
    ) {
      const entryPriceValue =
        order.entry?.priceEntry?.targetPriceUsd ||
        order.entry?.priceLogic?.threshold ||
        null;
      if (entryPriceValue && parseFloat(entryPriceValue) !== 0) {
        const entryPrice = formatUnits(
          BigInt(entryPriceValue),
          PRECISION_DECIMALS,
        );
        ids.push(
          addHorizontalLine(
            chart,
            Number(entryPrice),
            `${order.name}/${order.sl}_Entry`,
            "ENTRY",
          ),
        );
      }
    }

    // ─── NEW: Reverse-RSI estimated price lines ────────────────────
    if (candleMap) {
      const rsiConditions = extractRSIConditions(order);
      if (rsiConditions.length > 0) {
        ids.push(
          ...drawRSILines(
            chart,
            candleMap,
            rsiConditions,
            `${order.name}/${order.sl}_`,
            livePrice,
          ),
        );
      }
    }
  });

  return ids;
}

// ─── Legacy compat ─────────────────────────────────────────────────────

export function drawOrderLinesOnChart(chart, orders) {
  return drawOrderLinesWithMode(chart, orders, "all", null);
}

export function clearOrderLines(chart, ids) {
  if (!chart || !ids || ids.length === 0) return;
  ids.forEach((id) => {
    try {
      chart.removeEntity(id);
    } catch {
      /* ignore */
    }
  });
}

export function applyIndicatorStudy(widget, indicatorOnChart, resolutionMap) {
  if (!widget || !indicatorOnChart?.indicatorName) return null;
  const chart = widget.activeChart();
  const currentRes = chart.resolution();
  const targetRes = resolutionMap?.[indicatorOnChart.resolution];
  if (targetRes && currentRes != targetRes) chart.setResolution(targetRes);
  try {
    const params = indicatorOnChart.period
      ? { length: parseInt(indicatorOnChart.period) || 14 }
      : {};
    return chart.createStudy(indicatorOnChart.indicatorName, false, false, params);
  } catch (e) {
    console.error("Failed to create indicator:", e);
    return null;
  }
}