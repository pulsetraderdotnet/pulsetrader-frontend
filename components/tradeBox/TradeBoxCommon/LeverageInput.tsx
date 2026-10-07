import { useMemo, useState, useEffect, useRef } from "react";
import InfoTooltip from "./BoxTooltip";

interface LeverageInputProps {
  leverage: number;
  onLeverageChange: (value: number) => void;
  maxLeverage?: number;
}

const MIN_LEVERAGE = 1;

const LeverageInput = ({
  leverage,
  onLeverageChange,
  maxLeverage,
}: LeverageInputProps) => {
  const resolvedMaxLeverage = useMemo(() => {
    const parsedMax = Number(maxLeverage);
    if (!Number.isFinite(parsedMax) || parsedMax <= 0) {
      return 50;
    }
    return Math.max(MIN_LEVERAGE, Math.floor(parsedMax));
  }, [maxLeverage]);

  const clampLeverage = (value: number) => {
    if (!Number.isFinite(value)) {
      return MIN_LEVERAGE;
    }

    return Math.min(
      resolvedMaxLeverage,
      Math.max(MIN_LEVERAGE, Math.floor(value))
    );
  };

  const safeLeverage = clampLeverage(leverage);

  const [inputValue, setInputValue] = useState(String(safeLeverage));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(String(safeLeverage));
  }, [safeLeverage]);

  // If parent accidentally passes 0 or below min, push a valid value back up.
  useEffect(() => {
    if (leverage !== safeLeverage) {
      onLeverageChange(safeLeverage);
    }
  }, [leverage, safeLeverage, onLeverageChange]);

  const handleFocus = () => {
    inputRef.current?.select();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);

    // Do not convert empty input to 0 while the user is editing.
    if (raw.trim() === "") {
      return;
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      return;
    }

    const next = clampLeverage(num);
    setInputValue(String(next));
    onLeverageChange(next);
  };

  const handleBlur = () => {
    const num = Number(inputValue);

    const next =
      inputValue.trim() === "" || !Number.isFinite(num)
        ? safeLeverage
        : clampLeverage(num);

    setInputValue(String(next));
    onLeverageChange(next);
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = clampLeverage(Number(e.target.value));
    onLeverageChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    }
  };

  const fillPercentage =
    resolvedMaxLeverage <= MIN_LEVERAGE
      ? 100
      : Math.min(
        100,
        Math.max(
          0,
          ((safeLeverage - MIN_LEVERAGE) /
            (resolvedMaxLeverage - MIN_LEVERAGE)) *
          100
        )
      );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="flex items-center text-sm font-medium text-gray-700 dark:text-gray-200">
          Leverage
          <InfoTooltip
            id="leverage-tooltip"
            content="Leverage to use for the position"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min={MIN_LEVERAGE}
          max={resolvedMaxLeverage}
          step="1"
          value={safeLeverage}
          onChange={handleSliderChange}
          className="flex-1 h-2 rounded-lg appearance-none cursor-pointer transition-all"
          style={{
            backgroundImage: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${fillPercentage}%, #e5e7eb ${fillPercentage}%, #e5e7eb 100%)`,
            backgroundSize: "100% 100%",
            backgroundRepeat: "no-repeat",
          }}
        />

        <div className="w-24">
          <input
            ref={inputRef}
            type="number"
            min={MIN_LEVERAGE}
            max={resolvedMaxLeverage}
            step="1"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white transition-all"
          />
        </div>

        <span className="text-sm text-gray-600 dark:text-gray-400">X</span>
      </div>
    </div>
  );
};

export default LeverageInput;