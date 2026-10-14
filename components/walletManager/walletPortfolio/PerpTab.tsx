import { useState, useCallback, useEffect } from "react";
import { FiArrowDownCircle, FiArrowUpCircle, FiRefreshCw } from "react-icons/fi";
import toast from "react-hot-toast";

import PerpDepositModal from "@/components/walletManager/modal/PerpDepositModal";
import PerpWithdrawModal from "@/components/walletManager/modal/PerpWithdrawModal";
import { PRECISION_DECIMALS } from "@/constants/common/utils";
import { WalletType, UserType } from "@/type/common";
import { safeFormatNumber, safeParseUnits } from "@/utility/handy";
import { getPerpExchangeAvailableBalance } from "@/lib/oracle/perpAccountState";

type DexName = "asterdex" | "hyperliquid";

interface PerpBalances {
  asterdex: string;
  hyperliquid: string;
}

interface PerpTabProps {
  selectedWallet: WalletType;
  perpBalances: PerpBalances;
  onRefresh: () => void;
  user: UserType;
}

type PerpServiceResponse = {
  success?: boolean;
  balance?: number | string;
  message?: string;
  data?: { success?: boolean; balance?: number | string; message?: string };
};

const DEX_CONFIG = {
  asterdex: {
    label: "AsterDEX",
    color: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    activeBg: "bg-[#eeb36e]",
    gradient: "bg-[#eeb36e]",
  },
  hyperliquid: {
    label: "Hyperliquid",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    activeBg: "bg-[#97fce4]",
    gradient: "bg-[#97fce4]",
  },
} as const;

function extractBalance(res: PerpServiceResponse | any): string {
  if (res == null) return "0";
  const r = res as any;
  return String(r?.data?.availableValue ?? r?.availableValue ?? r?.data?.balance ?? r?.balance ?? 0);
}

function fmtUsd(val: string): string {
  return safeFormatNumber(String(val), PRECISION_DECIMALS, 4);
}

function hasApprovedAgent(wallet: WalletType, exchange: DexName, isMainnet: boolean): boolean {
  const targetExchange = isMainnet ? exchange.toLowerCase() : `${exchange.toLowerCase()}-testnet`;
  return (
    wallet.agentDetails?.some(
      (detail) =>
        detail.exchange?.toLowerCase() === targetExchange && detail.isApproved === true,
    ) === true
  );
}

export default function PerpTab({
  selectedWallet,
  perpBalances,
  onRefresh,
  user,
}: PerpTabProps) {
  const [activeDex, setActiveDex] = useState<DexName>("hyperliquid");
  const [isMainnet, setIsMainnet] = useState<boolean>(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localBalance, setLocalBalance] = useState<Record<DexName, string>>({
    asterdex: String(perpBalances.asterdex),
    hyperliquid: String(perpBalances.hyperliquid),
  });

  const currentRaw = localBalance[activeDex];
  const hasFunds = Number(currentRaw) > 0;
  const dex = DEX_CONFIG[activeDex];
  const isApproved = hasApprovedAgent(selectedWallet, activeDex, isMainnet);

  const handleRefreshBalance = useCallback(async () => {
    if (!selectedWallet?.address) return;
    setIsRefreshing(true);
    try {
      const balance = await getPerpExchangeAvailableBalance(
        selectedWallet.address,
        activeDex,
        isMainnet
      );
      const raw =
        balance !== undefined && balance !== null
          ? safeParseUnits(String(balance), PRECISION_DECIMALS)
          : "0";
      setLocalBalance((prev) => ({ ...prev, [activeDex]: raw }));
    } catch {
      toast.error("Failed to refresh balance");
    } finally {
      setIsRefreshing(false);
    }
  }, [activeDex, isMainnet, selectedWallet?.address]);

  useEffect(() => {
    handleRefreshBalance();
  }, [handleRefreshBalance]);

  const handleDexSwitch = useCallback(
    (next: DexName) => {
      setActiveDex(next);
    },
    [],
  );

  const handleWithdrawSuccess = useCallback(() => {
    handleRefreshBalance();
    onRefresh();
  }, [handleRefreshBalance, onRefresh]);

  return (
    <div className="space-y-4">
      {/* DEX Switcher & Network Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
        {/* DEX Switcher */}
        <div className="bg-white dark:bg-[#13131a] border border-black/5 dark:border-white/5 rounded-2xl p-1.5 flex gap-1 flex-1">
          {(["hyperliquid"] as DexName[]).map((d) => (
            <button
              key={d}
              onClick={() => handleDexSwitch(d)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeDex === d
                ? `${DEX_CONFIG[d].activeBg} text-black shadow-sm`
                : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
                }`}
            >
              {DEX_CONFIG[d].label}
            </button>
          ))}
        </div>

        {/* Network Toggle (Mainnet / Testnet) */}
        <div className="bg-white dark:bg-[#13131a] border border-black/5 dark:border-white/5 rounded-2xl p-1.5 flex gap-1 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setIsMainnet(true)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isMainnet
                ? "bg-emerald-500 text-white shadow-sm"
                : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${isMainnet ? "bg-white" : "bg-emerald-500"}`} />
            Mainnet
          </button>
          <button
            type="button"
            onClick={() => setIsMainnet(false)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${!isMainnet
                ? "bg-amber-500 text-white shadow-sm"
                : "text-gray-500 hover:text-black dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5"
              }`}
          >
            <span className={`w-2 h-2 rounded-full ${!isMainnet ? "bg-white" : "bg-amber-500"}`} />
            Testnet
          </button>
        </div>
      </div>

      {/* Balance Card */}
      <div className="bg-white dark:bg-[#13131a] border border-black/5 dark:border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">
              Perp Balance
            </p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${isMainnet
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                }`}
            >
              {isMainnet ? "Mainnet" : "Testnet"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className={`text-3xl font-black ${dex.color}`}>
              ${fmtUsd(String(currentRaw))}
            </p>
            <button
              onClick={handleRefreshBalance}
              disabled={isRefreshing}
              className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title="Refresh balance"
            >
              <FiRefreshCw
                size={13}
                className={`text-gray-400 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </button>
          </div>
          {!hasFunds && (
            <p className="text-xs text-amber-500 dark:text-amber-400 mt-1 font-medium">
              {isMainnet
                ? "Deposit at least 10 Arbitrum USDC to start. Estimated deposit time is 10-15 minutes."
                : "Deposit Arbitrum Sepolia testnet USDC to start trading on Hyperliquid Testnet."}
            </p>
          )}
          {isApproved && (
            <p className="text-xs text-emerald-500 dark:text-emerald-400 mt-1 font-semibold">
              Agent wallet already approved for {isMainnet ? "Mainnet" : "Testnet"} trading
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setIsDepositModalOpen(true)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold text-black transition-all ${dex.gradient} hover:opacity-90 active:scale-[0.98] flex items-center gap-2`}
          >
            <FiArrowDownCircle size={16} />
            Deposit
          </button>
          {hasFunds && (
            <button
              onClick={() => setIsWithdrawModalOpen(true)}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all bg-red-600 hover:bg-red-700 active:scale-[0.98] flex items-center gap-2"
            >
              <FiArrowUpCircle size={16} />
              Withdraw
            </button>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div className={`${dex.bg} ${dex.border} border rounded-2xl p-4`}>
        <p className="text-sm font-bold text-black dark:text-white mb-1">
          Deposit perp collateral ({isMainnet ? "Mainnet" : "Testnet"})
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Deposit collateral into your {DEX_CONFIG[activeDex].label} {isMainnet ? "Mainnet" : "Testnet"} perp account.
        </p>
      </div>

      {isDepositModalOpen && (
        <PerpDepositModal
          isOpen={isDepositModalOpen}
          onClose={() => {
            setIsDepositModalOpen(false);
            setTimeout(() => {
              handleRefreshBalance();
              onRefresh();
            }, 2000);
          }}
          wallet={selectedWallet}
          initialDex={activeDex}
          user={user}
          isMainnet={isMainnet}
        />
      )}

      {isWithdrawModalOpen && (
        <PerpWithdrawModal
          isOpen={isWithdrawModalOpen}
          onClose={() => setIsWithdrawModalOpen(false)}
          wallet={selectedWallet}
          dex={activeDex}
          currentBalanceUsd={currentRaw}
          onWithdrawSuccess={handleWithdrawSuccess}
          isMainnet={isMainnet}
        />
      )}
    </div>
  );
}