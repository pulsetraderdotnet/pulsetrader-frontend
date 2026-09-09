import { formatUnits } from "ethers";
import { PRECISION_DECIMALS } from "@/constants/common/utils";

const LINE_STYLE = {
  TP: { linecolor: "#05aa58", textcolor: "#05aa58" },
  SL: { linecolor: "#aa0573", textcolor: "#aa0573" },
  LIQ: { linecolor: "#a7a605", textcolor: "#a7a605" },
  ENTRY: { linecolor: "#e0d5d5", textcolor: "#e0d5d5" },
  BUY: { color: "#00ff00" },
  SELL: { color: "#ff0000" },
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

/**
 * Draws chart lines based on the display mode.
 * @param {object} chart - TradingView chart instance.
 * @param {OrderType[]} orders - Full list of orders from the store.
 * @param {string} mode - 'all' | 'pending' | 'opened' | 'closed' | 'single'
 * @param {string|null} singleOrderId - The ID of the single order to display (when mode === 'single')
 * @returns {number[]} List of entity IDs created.
 */
export function drawOrderLinesWithMode(chart, orders, mode = "all", singleOrderId = null) {
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
    // ─── Entry ticker (for opened and closed) ──────────────────────
    if (
      order.executionDetails?.entryAt &&
      order.executionDetails?.entryPriceUsd &&
      parseFloat(order.executionDetails.entryPriceUsd) !== 0
    ) {
      const entryPrice = formatUnits(
        BigInt(order.executionDetails.entryPriceUsd),
        PRECISION_DECIMALS,
      );
      const entryTime = Math.floor(parseFloat(order.executionDetails.entryAt) / 1000);
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

    // ─── Exit ticker (for closed) ──────────────────────────────────
    if (
      order.executionDetails?.exitAt &&
      order.executionDetails?.exitPriceUsd &&
      parseFloat(order.executionDetails.exitPriceUsd) !== 0
    ) {
      const exitPrice = formatUnits(
        BigInt(order.executionDetails.exitPriceUsd),
        PRECISION_DECIMALS,
      );
      const exitTime = Math.floor(parseFloat(order.executionDetails.exitAt) / 1000);
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

    // ─── OPENED orders: TP, SL, LIQ lines ──────────────────────────
    if (order.orderStatus === "OPENED" && order.orderType === "SELL") {
      if (order.exit.takeProfit?.takeProfitPrice && parseFloat(order.exit.takeProfit.takeProfitPrice) !== 0) {
        const tpPrice = formatUnits(
          BigInt(order.exit.takeProfit.takeProfitPrice),
          PRECISION_DECIMALS,
        );
        ids.push(addHorizontalLine(chart, Number(tpPrice), `${order.name}/${order.sl}_TP`, "TP"));
      }
      if (order.exit.stopLoss?.stopLossPrice && parseFloat(order.exit.stopLoss.stopLossPrice) !== 0) {
        const slPrice = formatUnits(
          BigInt(order.exit.stopLoss.stopLossPrice),
          PRECISION_DECIMALS,
        );
        ids.push(addHorizontalLine(chart, Number(slPrice), `${order.name}/${order.sl}_SL`, "SL"));
      }
      if (order.category === "perpetual" && order.executionDetails?.liquidationPriceUsd && parseFloat(order.executionDetails.liquidationPriceUsd) !== 0) {
        const liqPrice = formatUnits(
          BigInt(order.executionDetails.liquidationPriceUsd),
          PRECISION_DECIMALS,
        );
        ids.push(addHorizontalLine(chart, Number(liqPrice), `${order.name}/${order.sl}_LIQ`, "LIQ"));
      }
    }

    // ─── PENDING BUY orders: entry reference line ──────────────────
    if (
      order.orderStatus === "PENDING" &&
      order.orderType === "BUY" &&
      !order.entry?.isTechnicalEntry
    ) {
      let entryPriceValue =
        order.entry?.priceEntry?.targetPriceUsd ||
        order.entry?.priceLogic?.threshold ||
        null;
      if (entryPriceValue && parseFloat(entryPriceValue) !== 0) {
        const entryPrice = formatUnits(BigInt(entryPriceValue), PRECISION_DECIMALS);
        ids.push(
          addHorizontalLine(chart, Number(entryPrice), `${order.name}/${order.sl}_Entry`, "ENTRY"),
        );
      }
    }
  });

  return ids;
}

// ─── Legacy function (kept for backward compatibility) ──────────────
export function drawOrderLinesOnChart(chart, orders) {
  return drawOrderLinesWithMode(chart, orders, "all", null);
}

export function clearOrderLines(chart, ids) {
  if (!chart || !ids || ids.length === 0) return;
  ids.forEach((id) => {
    try {
      chart.removeEntity(id);
    } catch {
      // ignore
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