"use client";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiShield, FiArrowRight, FiLock } from "react-icons/fi";
import OrderList from "@/components/order/dashboard/OrderList";
import { useStore } from "@/store/useStore";
import { useShallow } from "zustand/shallow";

export default function OrderDashboard() {
  const router = useRouter();
  const { user, isConnected, userOrders, network } = useStore(
    useShallow((state: any) => ({
      user: state.user,
      isConnected: state.isConnected,
      userOrders: state.userOrders,
      network: state.network,
    }))
  );

  if (!isConnected || !user?.account) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] bg-blue-600/5 dark:bg-blue-600/5 blur-[120px] rounded-full" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 text-center p-10 bg-white/80 dark:bg-white/[0.03] backdrop-blur-2xl border border-gray-200/60 dark:border-white/[0.06] rounded-3xl shadow-2xl max-w-md w-full"
        >
          {/* Glow border */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-blue-500/10 to-transparent opacity-60 pointer-events-none" />

          {/* Icon */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2, duration: 0.4, type: "spring", stiffness: 200 }}
            className="relative w-24 h-24 mx-auto mb-7"
          >
            {/* Outer ring pulse */}
            <div className="absolute inset-0 rounded-3xl bg-blue-500/10 animate-ping opacity-30" />
            <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-blue-500/20 to-violet-600/20 border border-blue-500/20 flex items-center justify-center">
              <FiShield className="w-10 h-10 text-blue-400" />
              <div className="absolute top-2 right-2 w-3 h-3 rounded-full border border-amber-400/60 flex items-center justify-center">
                <FiLock className="w-1.5 h-1.5 text-amber-400" />
              </div>
            </div>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-2xl font-black text-gray-900 dark:text-white mb-2 tracking-tight"
          >
            Access Restricted
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="text-gray-500 dark:text-slate-400 text-sm mb-8 leading-relaxed"
          >
            Connect your decentralized wallet to view and manage your orders, positions, and strategy history.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/connect")}
              className="group w-full py-3.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-2xl font-bold transition-all shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 text-sm"
            >
              Connect Wallet
              <FiArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <p className="text-[10px] text-gray-400 dark:text-slate-600 font-mono">
              Non-custodial · Your keys, your assets
            </p>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <OrderList
        network={network}
        userOrders={userOrders}
        orderCategory="all"
        isConnected={isConnected}
      />
    </div>
  );
}
