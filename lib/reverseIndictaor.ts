/**
 * Reverse RSI — given historical closes and a target RSI value,
 * compute the exact price at which the next close would produce that RSI.
 *
 * Two candidate prices are returned:
 *   - `up`   : price if the next move is upward  (close > prevClose)
 *   - `down` : price if the next move is downward (close < prevClose)
 *
 * Exactly one candidate is geometrically valid for a given target RSI,
 * exposed as `valid`.
 */

// ─── Types ──────────────────────────────────────────────────────────────

export interface WilderRSIState {
    /** Wilder-smoothed average gain up to the latest candle */
    avgGain: number;
    /** Wilder-smoothed average loss up to the latest candle */
    avgLoss: number;
    /** Number of candles consumed */
    candles: number;
    /** RSI period used */
    period: number;
}

export interface ReverseRSIResult {
    /** The last close used as the reference (latest candle) */
    referencePrice: number;
    /** Price needed for the next close to yield `targetRSI` if the move is up */
    up: number | null;
    /** Price needed for the next close to yield `targetRSI` if the move is down */
    down: number | null;
    /** The geometrically valid candidate (`up` or `down`) */
    valid: number | null;
    /** Current RSI computed from the last candle */
    currentRSI: number;
    /** Target RSI that was solved for */
    targetRSI: number;
    /** Period used */
    period: number;
}

export interface ReverseRSIOptions {
    /** RSI period (default 14) */
    period?: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Compute Wilder's smoothed avgGain / avgLoss up to the latest candle.
 *
 * Seeding: simple average of the first `period` changes,
 * then Wilder smoothing for the rest.
 */
export function computeWilderRSIState(
    closes: readonly number[],
    period = 14,
): WilderRSIState {
    const N = period;

    if (!Array.isArray(closes) || closes.length < N + 1) {
        throw new Error(
            `computeWilderRSIState: need at least ${N + 1} closes, got ${closes?.length ?? 0}`,
        );
    }

    let gainSum = 0;
    let lossSum = 0;

    // Seed: simple average of the first N deltas
    for (let i = 1; i <= N; i++) {
        const diff = closes[i] - closes[i - 1];
        if (diff > 0) gainSum += diff;
        else if (diff < 0) lossSum -= diff;
    }

    let avgGain = gainSum / N;
    let avgLoss = lossSum / N;

    // Wilder smoothing for the remainder
    for (let i = N + 1; i < closes.length; i++) {
        const diff = closes[i] - closes[i - 1];
        const gain = diff > 0 ? diff : 0;
        const loss = diff < 0 ? -diff : 0;

        avgGain = (avgGain * (N - 1) + gain) / N;
        avgLoss = (avgLoss * (N - 1) + loss) / N;
    }

    return { avgGain, avgLoss, candles: closes.length, period: N };
}

// ─── Main ───────────────────────────────────────────────────────────────

/**
 * Reverse RSI — solve for the price that would produce `targetRSI`.
 *
 * @param closes     Chronological closes (oldest → newest)
 * @param targetRSI  Target RSI strictly between 0 and 100 (exclusive)
 * @param options    Optional { period }
 */
export function reverseRSI(
    closes: readonly number[],
    targetRSI: number,
    options: ReverseRSIOptions = {},
): ReverseRSIResult {
    const period = options.period ?? 14;

    if (!Number.isFinite(targetRSI) || targetRSI <= 0 || targetRSI >= 100) {
        throw new Error("reverseRSI: targetRSI must be strictly between 0 and 100");
    }

    const N = period;
    const { avgGain, avgLoss } = computeWilderRSIState(closes, N);
    const prevClose = closes[closes.length - 1];

    // Current RSI (for reference / display)
    const currentRSI =
        avgLoss === 0
            ? 100
            : 100 - 100 / (1 + avgGain / avgLoss);

    // Target Relative Strength
    const T = targetRSI / (100 - targetRSI);

    // ── Candidate 1: upward move (close > prevClose) ──────────────────
    // close = prevClose + (N-1) * (T * avgLoss - avgGain)
    const upRaw = prevClose + (N - 1) * (T * avgLoss - avgGain);
    const up = upRaw > prevClose ? upRaw : null;

    // ── Candidate 2: downward move (close < prevClose) ────────────────
    // close = prevClose + (N-1) * (avgLoss - avgGain / T)
    const downRaw = prevClose + (N - 1) * (avgLoss - avgGain / T);
    const down = downRaw < prevClose ? downRaw : null;

    return {
        referencePrice: prevClose,
        up,
        down,
        valid: up ?? down,
        currentRSI,
        targetRSI,
        period: N,
    };
}

// ─── Convenience: multi-target solve ───────────────────────────────────

/**
 * Solve for multiple RSI targets in a single pass.
 * Useful for drawing both TP (RSI 70) and SL (RSI 30) reference lines
 * without recomputing the Wilder state twice.
 */
export function reverseRSIMultiple(
    closes: readonly number[],
    targets: readonly number[],
    options: ReverseRSIOptions = {},
): Map<number, ReverseRSIResult> {
    const period = options.period ?? 14;
    const N = period;
    const { avgGain, avgLoss } = computeWilderRSIState(closes, N);
    const prevClose = closes[closes.length - 1];

    const currentRSI =
        avgLoss === 0
            ? 100
            : 100 - 100 / (1 + avgGain / avgLoss);

    const out = new Map<number, ReverseRSIResult>();

    for (const targetRSI of targets) {
        if (!Number.isFinite(targetRSI) || targetRSI <= 0 || targetRSI >= 100) {
            continue;
        }

        const T = targetRSI / (100 - targetRSI);

        const upRaw = prevClose + (N - 1) * (T * avgLoss - avgGain);
        const up = upRaw > prevClose ? upRaw : null;

        const downRaw = prevClose + (N - 1) * (avgLoss - avgGain / T);
        const down = downRaw < prevClose ? downRaw : null;

        out.set(targetRSI, {
            referencePrice: prevClose,
            up,
            down,
            valid: up ?? down,
            currentRSI,
            targetRSI,
            period: N,
        });
    }

    return out;
}

// ─── Convenience: incremental state updater ─────────────────────────────

/**
 * Given a Wilder state and the next close, produce the updated state.
 * O(1) — useful for streaming / live-candle updates without rescanning.
 */
export function updateWilderRSIState(
    state: WilderRSIState,
    nextClose: number,
    prevClose: number,
): WilderRSIState {
    const N = state.period;
    const diff = nextClose - prevClose;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    return {
        avgGain: (state.avgGain * (N - 1) + gain) / N,
        avgLoss: (state.avgLoss * (N - 1) + loss) / N,
        candles: state.candles + 1,
        period: N,
    };
}

// ─── Order Condition Extraction ─────────────────────────────────────────

export interface RSICondition {
    targetRSI: number;
    operator: string;
    timeframe: string;
    period: number;
    source: "entry_logic" | "entry_weight";
}

/**
 * Walk an order's technical entry config and extract all RSI conditions.
 */
export function extractRSIConditions(order: any): RSICondition[] {
    const conditions: RSICondition[] = [];

    const walk = (node: any, source: "entry_logic" | "entry_weight") => {
        if (!node) return;

        const metric = node.metric || node.metrics;
        if (typeof metric === "string" && metric.toLowerCase() === "rsi" && node.value != null) {
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

        if (Array.isArray(node.logic)) {
            node.logic.forEach((child: any) => walk(child, source));
        }
        if (Array.isArray(node.weights)) {
            node.weights.forEach((child: any) => walk(child, source));
        }
    };

    walk(order?.entry?.technicalLogic, "entry_logic");
    walk(order?.entry?.technicalWeights, "entry_weight");

    return conditions;
}