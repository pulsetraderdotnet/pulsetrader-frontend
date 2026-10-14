"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
    FiSave,
    FiPlus,
    FiX,
    FiRefreshCw,
    FiLock,
    FiEye,
    FiEyeOff,
    FiToggleLeft,
    FiToggleRight,
    FiEdit2,
    FiTrash2,
    FiUsers,
    FiSearch,
    FiLink,
} from "react-icons/fi";

import AdminService from "@/service/admin-service";
import toast from "react-hot-toast";

// ─── Types aligned with the updated SystemSchema ─────────────────────────────
type ListeningState = {
    isListening: boolean;
    isSpotListening: boolean;
    isAsterdexListening: boolean;
    isHyperLiquidListening: boolean;
};

type NativeToken = { name: string; decimals: number; address: string; };
type StableToken = { symbol: string; decimals: number; address: string; };

type ChainConfig = {
    _id?: string;
    rpcUrls: string[];
    privateRpcs: string[];
    chainId: number;
    name: string;
    symbol: string;
    imageUrl: string;
    nativeToken: NativeToken;
    isPerpetual: boolean;
    isActive: boolean;
    networkType: string;
    stableTokens: StableToken[];
};

type SystemData = {
    _id?: string;
    listening?: ListeningState;
    config?: Record<string, any>;
    userLevels?: Record<string, any>;
    chainConfig?: ChainConfig[];
};

type UserLevelEntry = {
    id: string;
    benefits: {
        maxOrder: number | string;
        maxWallets: number;
        maxEVMWallets: number;
        maxSVMWallets: number;
        maxAccessAsset: number;
        supportTrading: string[];
        supportStrategy: string[];
        maxPerpAgentWallet: number;
        isDemoTestnet: boolean;
        isTradeFeeExempt?: boolean;
    };
    requirements: Record<string, { quantity: string }>;
};

const DEFAULT_LISTENING: ListeningState = {
    isListening: false,
    isSpotListening: false,
    isAsterdexListening: false,
    isHyperLiquidListening: false,
};

const DEFAULT_CHAIN: ChainConfig = {
    rpcUrls: [], privateRpcs: [], chainId: 0, name: "", symbol: "", imageUrl: "",
    nativeToken: { name: "", decimals: 18, address: "" },
    isPerpetual: false, isActive: true, networkType: "mainnet", stableTokens: [],
};

// ─── ListenerToggle sub-component ────────────────────────────────────────────
function ListenerToggleRow({ label, description, value, loading, onToggle }: {
    label: string; description?: string; value: boolean; loading: boolean; onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
            <div>
                <p className="text-xs font-medium text-white">{label}</p>
                {description && <p className="text-[10px] text-gray-500 mt-0.5">{description}</p>}
            </div>
            <div className="flex items-center gap-2.5">
                <span className={`text-[10px] font-medium ${value ? "text-emerald-400" : "text-gray-500"}`}>
                    <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1 ${value ? "bg-emerald-400 animate-pulse" : "bg-gray-600"}`} />
                    {value ? "On" : "Off"}
                </span>
                <button onClick={onToggle} disabled={loading} className="transition-all disabled:opacity-40">
                    {value ? <FiToggleRight className="h-7 w-7 text-emerald-400 hover:text-emerald-300" /> : <FiToggleLeft className="h-7 w-7 text-gray-600 hover:text-gray-400" />}
                </button>
            </div>
        </div>
    );
}

export default function AdminSystemPanel({ initialSystemData }: { initialSystemData?: any }) {
    const [systemData, setSystemData] = useState<SystemData>(initialSystemData?.systemData || {});
    const [loading, setLoading] = useState(false);
    const [listeningLoading, setListeningLoading] = useState(false);

    // Config editor state
    const [editingKey, setEditingKey] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [configSearchTerm, setConfigSearchTerm] = useState("");

    // Password change state
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showNewPass, setShowNewPass] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    // User levels state
    const [editingLevelData, setEditingLevelData] = useState<UserLevelEntry | null>(null);
    const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
    const [isNewLevel, setIsNewLevel] = useState(false);

    // Chain config state
    const [isChainModalOpen, setIsChainModalOpen] = useState(false);
    const [editingChainIndex, setEditingChainIndex] = useState<number | null>(null);
    const [editingChain, setEditingChain] = useState<ChainConfig>(DEFAULT_CHAIN);
    const [newRpcUrl, setNewRpcUrl] = useState("");
    const [newPrivateRpc, setNewPrivateRpc] = useState("");
    const [newStableToken, setNewStableToken] = useState<StableToken>({ symbol: "", decimals: 18, address: "" });

    // Derived listening state
    const listening: ListeningState = { ...DEFAULT_LISTENING, ...(systemData.listening || {}) };

    const fetchSystemData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await AdminService.getSystemData();
            if (res?.success && res?.data) {
                setSystemData(res.data.systemData || {});
            }
        } catch (err) {
            console.error("Failed to fetch system data:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!initialSystemData) fetchSystemData();
    }, [fetchSystemData, initialSystemData]);

    // ─── Listener Toggles ─────────────────────────────────────────────────────
    const toggleListeningFlag = async (key: keyof ListeningState) => {
        setListeningLoading(true);
        const newValue = !listening[key];
        try {
            const res = await AdminService.updateSystem({ listening: { [key]: newValue } });
            if (res?.success) {
                setSystemData((prev) => ({ ...prev, listening: { ...listening, [key]: newValue } }));
                toast.success(`${key} ${newValue ? "enabled" : "disabled"}`);
            } else {
                toast.error("Failed to update listener");
            }
        } catch {
            toast.error("Failed to update listener");
        } finally {
            setListeningLoading(false);
        }
    };

    // ─── Config Editor ─────────────────────────────────────────────────────
    const saveConfigValue = async (key: string) => {
        let parsedValue: any = editingValue;
        if (editingValue === "true") parsedValue = true;
        else if (editingValue === "false") parsedValue = false;
        else if (!isNaN(Number(editingValue)) && editingValue.trim() !== "") parsedValue = Number(editingValue);
        else {
            try {
                parsedValue = JSON.parse(editingValue);
            } catch {
                /* keep as string */
            }
        }

        try {
            const res = await AdminService.updateSystem({ configUpdates: { [key]: parsedValue } });
            if (res?.success) {
                setSystemData((prev) => ({
                    ...prev,
                    config: { ...prev.config, [key]: parsedValue },
                }));
                setEditingKey(null);
                setEditingValue("");

                toast.success(`Config "${key}" updated`);
            }
        } catch {
            toast.error("Failed to update config");
        }
    };

    // ─── Password Change ──────────────────────────────────────────────────
    const changePassword = async () => {
        if (!newPassword || newPassword.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        setPasswordLoading(true);
        try {
            const res = await AdminService.updateSystem({ newPassword });
            if (res?.success) {
                toast.success("Admin password changed successfully");
                setNewPassword("");
                setConfirmPassword("");
                setShowPasswordForm(false);
            } else {
                toast.error(res?.message || "Failed to change password");
            }
        } catch {
            toast.error("Failed to change password");
        } finally {
            setPasswordLoading(false);
        }
    };

    // ─── User Level Management ────────────────────────────────────────────────
    const userLevels = systemData.userLevels || {};

    const openLevelModal = (levelId?: string) => {
        if (levelId) {
            const levelData = userLevels[levelId];
            if (levelData) {
                setEditingLevelData({ id: levelId, ...levelData } as UserLevelEntry);
                setIsNewLevel(false);
            }
        } else {
            setEditingLevelData({
                id: "",
                benefits: {
                    maxOrder: 10, maxWallets: 3, maxEVMWallets: 2, maxSVMWallets: 1,
                    maxAccessAsset: 5, supportTrading: ["spot"], supportStrategy: ["limit"],
                    maxPerpAgentWallet: 1, isDemoTestnet: false, isTradeFeeExempt: false,
                },
                requirements: {},
            });
            setIsNewLevel(true);
        }
        setIsLevelModalOpen(true);
    };

    const closeLevelModal = () => { setIsLevelModalOpen(false); setEditingLevelData(null); setIsNewLevel(false); };

    const saveUserLevel = async () => {
        if (!editingLevelData) return;
        const { id, ...levelData } = editingLevelData;
        if (!id.trim()) { toast.error("Level ID is required"); return; }
        const newUserLevels = { ...userLevels, [id]: levelData };
        try {
            const res = await AdminService.updateSystem({ userLevels: newUserLevels });
            if (res?.success) {
                setSystemData((prev) => ({ ...prev, userLevels: newUserLevels }));
                toast.success(isNewLevel ? "User level created" : "User level updated");
                closeLevelModal();
            } else { toast.error("Failed to save user level"); }
        } catch { toast.error("Failed to save user level"); }
    };

    const deleteUserLevel = async (levelId: string) => {
        if (!confirm(`Delete user level "${levelId}"? This action cannot be undone.`)) return;
        const newUserLevels = { ...userLevels };
        delete newUserLevels[levelId];
        try {
            const res = await AdminService.updateSystem({ userLevels: newUserLevels });
            if (res?.success) {
                setSystemData((prev) => ({ ...prev, userLevels: newUserLevels }));
                toast.success(`Level "${levelId}" deleted`);
            } else { toast.error("Failed to delete user level"); }
        } catch { toast.error("Failed to delete user level"); }
    };

    // ─── Chain Config Management ──────────────────────────────────────────────
    const chainConfigs: ChainConfig[] = systemData.chainConfig || [];

    const openChainModal = (index?: number) => {
        if (index !== undefined) {
            setEditingChain({ ...DEFAULT_CHAIN, ...chainConfigs[index] });
            setEditingChainIndex(index);
        } else {
            setEditingChain({ ...DEFAULT_CHAIN });
            setEditingChainIndex(null);
        }
        setNewRpcUrl(""); setNewPrivateRpc("");
        setNewStableToken({ symbol: "", decimals: 18, address: "" });
        setIsChainModalOpen(true);
    };

    const closeChainModal = () => { setIsChainModalOpen(false); setEditingChain(DEFAULT_CHAIN); setEditingChainIndex(null); };

    const saveChainConfig = async () => {
        if (!editingChain.name.trim() || !editingChain.chainId) { toast.error("Chain name and Chain ID are required"); return; }
        const updatedChains = [...chainConfigs];
        if (editingChainIndex !== null) { updatedChains[editingChainIndex] = editingChain; } else { updatedChains.push(editingChain); }
        try {
            const res = await AdminService.updateSystem({ chainConfigs: updatedChains });
            if (res?.success) {
                setSystemData((prev) => ({ ...prev, chainConfig: updatedChains }));
                toast.success(editingChainIndex !== null ? "Chain updated" : "Chain added");
                closeChainModal();
            } else { toast.error("Failed to save chain config"); }
        } catch { toast.error("Failed to save chain config"); }
    };

    const deleteChainConfig = async (index: number) => {
        const chain = chainConfigs[index];
        if (!confirm(`Delete chain "${chain.name}"?`)) return;
        const updatedChains = chainConfigs.filter((_, i) => i !== index);
        try {
            const res = await AdminService.updateSystem({ chainConfigs: updatedChains });
            if (res?.success) {
                setSystemData((prev) => ({ ...prev, chainConfig: updatedChains }));
                toast.success("Chain deleted");
            } else { toast.error("Failed to delete chain"); }
        } catch { toast.error("Failed to delete chain"); }
    };

    const config = systemData.config || {};
    const configEntries = useMemo(
        () => Object.entries(config).sort(([a], [b]) => a.localeCompare(b)),
        [config]
    );

    // Filter config entries by search term
    const filteredConfigEntries = useMemo(
        () =>
            configEntries.filter(([key]) =>
                key.toLowerCase().includes(configSearchTerm.toLowerCase())
            ),
        [configEntries, configSearchTerm]
    );

    return (
        <div className="space-y-6">
            {/* ─── Listening Flags ──────────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <h3 className="text-sm font-semibold text-white">Listener Controls</h3>
                    <span className="text-xs text-gray-500">({Object.values(listening).filter(Boolean).length}/4 active)</span>
                </div>
                <ListenerToggleRow label="Master Listener" description="Main order evaluation engine" value={listening.isListening} loading={listeningLoading} onToggle={() => toggleListeningFlag("isListening")} />
                <ListenerToggleRow label="Spot Listener" description="Monitors spot market orders" value={listening.isSpotListening} loading={listeningLoading} onToggle={() => toggleListeningFlag("isSpotListening")} />
                <ListenerToggleRow label="Asterdex Listener" description="Monitors Asterdex perpetual orders" value={listening.isAsterdexListening} loading={listeningLoading} onToggle={() => toggleListeningFlag("isAsterdexListening")} />
                <ListenerToggleRow label="HyperLiquid Listener" description="Monitors HyperLiquid perpetual orders" value={listening.isHyperLiquidListening} loading={listeningLoading} onToggle={() => toggleListeningFlag("isHyperLiquidListening")} />
            </div>

            {/* ─── Chain Config ─────────────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <FiLink className="h-4 w-4 text-cyan-400" />
                        <h3 className="text-sm font-semibold text-white">Chain Configurations</h3>
                        <span className="text-xs text-gray-500">({chainConfigs.length} chains)</span>
                    </div>
                    <button onClick={() => openChainModal()} className="flex items-center gap-1.5 rounded-lg bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 transition-colors">
                        <FiPlus className="h-3.5 w-3.5" /> Add Chain
                    </button>
                </div>
                <div className="max-h-[360px] overflow-y-auto">
                    {chainConfigs.length === 0 ? (
                        <div className="px-5 py-8 text-center text-xs text-gray-600">No chains configured</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                                <tr className="border-b border-white/10">
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Name</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Chain ID</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Symbol</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Type</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Status</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[80px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {chainConfigs.map((chain, idx) => (
                                    <tr key={chain._id || idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-2.5 text-xs font-medium text-white">
                                            <div className="flex items-center gap-2">
                                                {chain.imageUrl ? (
                                                    <img
                                                        src={chain.imageUrl}
                                                        alt={chain.name}
                                                        className="w-5 h-5 rounded-full object-contain bg-white/5 p-0.5 border border-white/10 shrink-0"
                                                        onError={(e) => { (e.currentTarget.style.display = "none"); }}
                                                    />
                                                ) : (
                                                    <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                                                        {chain.symbol?.slice(0, 2) || chain.name?.slice(0, 2) || "?"}
                                                    </div>
                                                )}
                                                <span>{chain.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-cyan-400 font-mono">{chain.chainId}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-300">{chain.symbol}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-400">
                                            <span className="flex gap-1">
                                                {chain.networkType && <span className="rounded px-1.5 py-0.5 bg-white/5 text-[10px] text-gray-400">{chain.networkType}</span>}
                                                {chain.isPerpetual && <span className="rounded px-1.5 py-0.5 bg-violet-500/10 text-[10px] text-violet-400">perp</span>}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <span className={`text-[10px] font-medium ${chain.isActive ? "text-emerald-400" : "text-gray-600"}`}>
                                                {chain.isActive ? "Active" : "Inactive"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => openChainModal(idx)} className="rounded-md p-1 text-gray-500 hover:text-blue-400 transition-colors" title="Edit"><FiEdit2 className="h-3.5 w-3.5" /></button>
                                                <button onClick={() => deleteChainConfig(idx)} className="rounded-md p-1 text-gray-500 hover:text-red-400 transition-colors" title="Delete"><FiTrash2 className="h-3.5 w-3.5" /></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ─── User Levels Management ──────────────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                    <div className="flex items-center gap-2">
                        <FiUsers className="h-4 w-4 text-violet-400" />
                        <h3 className="text-sm font-semibold text-white">User Levels</h3>
                        <span className="text-xs text-gray-500">({Object.keys(userLevels).length} levels)</span>
                    </div>
                    <button
                        onClick={() => openLevelModal()}
                        className="flex items-center gap-1.5 rounded-lg bg-violet-600/20 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-600/30 transition-colors"
                    >
                        <FiPlus className="h-3.5 w-3.5" />
                        Add Level
                    </button>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                    {Object.keys(userLevels).length === 0 ? (
                        <div className="px-5 py-8 text-center text-xs text-gray-600">No user levels configured</div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                                <tr className="border-b border-white/10">
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Level ID</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Max Orders</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Max Wallets</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Trading</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Strategies</th>
                                    <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[80px]">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(userLevels).map(([id, level]: [string, any]) => (
                                    <tr key={id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-2.5 text-xs font-mono text-violet-400">{id}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-300">{level.benefits?.maxOrder ?? "—"}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-300">{level.benefits?.maxWallets ?? "—"}</td>
                                        <td className="px-5 py-2.5 text-xs text-gray-300">
                                            {level.benefits?.supportTrading?.join(", ") || "—"}
                                        </td>
                                        <td className="px-5 py-2.5 text-xs text-gray-300">
                                            {level.benefits?.supportStrategy?.join(", ") || "—"}
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => openLevelModal(id)}
                                                    className="rounded-md p-1 text-gray-500 hover:text-blue-400 transition-colors"
                                                    title="Edit"
                                                >
                                                    <FiEdit2 className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    onClick={() => deleteUserLevel(id)}
                                                    className="rounded-md p-1 text-gray-500 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <FiTrash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ─── Config Key-Value Editor ──────────────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden shadow-sm">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                    <h3 className="text-sm font-semibold text-white">System Configuration</h3>
                    <div className="flex items-center gap-2">
                        {/* Search Input */}
                        <div className="relative">
                            <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
                            <input
                                type="text"
                                placeholder="Search config keys..."
                                value={configSearchTerm}
                                onChange={(e) => setConfigSearchTerm(e.target.value)}
                                className="w-48 rounded-md border border-white/10 bg-white/5 px-7 py-1.5 text-xs text-white placeholder-gray-500 outline-none focus:border-violet-500/50"
                            />
                            {configSearchTerm && (
                                <button
                                    onClick={() => setConfigSearchTerm("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                                >
                                    <FiX className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={fetchSystemData}
                            disabled={loading}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                        >
                            <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </div>
                <div className="max-h-[450px] overflow-y-auto">
                    <table className="w-full text-left">
                        <thead className="sticky top-0 bg-gray-900/95 backdrop-blur-sm">
                            <tr className="border-b border-white/10">
                                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[40%]">Key</th>
                                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Value</th>
                                <th className="px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500 w-[80px]">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredConfigEntries.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-5 py-8 text-center text-xs text-gray-600">
                                        {configSearchTerm ? "No matching config keys" : "No config entries"}
                                    </td>
                                </tr>
                            ) : (
                                filteredConfigEntries.map(([key, value]) => (
                                    <tr key={key} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="px-5 py-2.5 text-xs text-gray-400 font-mono">{key}</td>
                                        <td className="px-5 py-2.5">
                                            {editingKey === key ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") saveConfigValue(key);
                                                        if (e.key === "Escape") {
                                                            setEditingKey(null);
                                                            setEditingValue("");
                                                        }
                                                    }}
                                                    autoFocus
                                                    className="w-full rounded-md border border-violet-500/40 bg-violet-500/5 px-2.5 py-1 text-xs text-white outline-none focus:border-violet-500/60"
                                                />
                                            ) : (
                                                <span
                                                    className="text-xs text-gray-300 font-mono cursor-pointer hover:text-white transition-colors block max-w-[300px] truncate"
                                                    title={String(value)}
                                                    onClick={() => {
                                                        setEditingKey(key);
                                                        setEditingValue(typeof value === "object" ? JSON.stringify(value) : String(value));
                                                    }}
                                                >
                                                    {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-2.5">
                                            {editingKey === key ? (
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => saveConfigValue(key)}
                                                        className="rounded-md bg-emerald-600/20 p-1 text-emerald-400 hover:bg-emerald-600/30 transition-colors"
                                                    >
                                                        <FiSave className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setEditingKey(null);
                                                            setEditingValue("");
                                                        }}
                                                        className="rounded-md bg-gray-600/20 p-1 text-gray-400 hover:bg-gray-600/30 transition-colors"
                                                    >
                                                        <FiX className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setEditingKey(key);
                                                        setEditingValue(typeof value === "object" ? JSON.stringify(value) : String(value));
                                                    }}
                                                    className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
                                                >
                                                    Edit
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ─── Change Admin Password ────────────────────────────────────────── */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FiLock className="h-4 w-4 text-gray-500" />
                        <h3 className="text-sm font-semibold text-white">Admin Password</h3>
                    </div>
                    <button
                        onClick={() => setShowPasswordForm(!showPasswordForm)}
                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                    >
                        {showPasswordForm ? "Cancel" : "Change Password"}
                    </button>
                </div>
                {showPasswordForm && (
                    <div className="space-y-3">
                        <div className="relative">
                            <input
                                type={showNewPass ? "text" : "password"}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="New password (min 6 characters)"
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-500/50 pr-8"
                            />
                            <button
                                onClick={() => setShowNewPass(!showNewPass)}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500"
                            >
                                {showNewPass ? <FiEyeOff className="h-3.5 w-3.5" /> : <FiEye className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-500/50"
                        />
                        <button
                            onClick={changePassword}
                            disabled={passwordLoading}
                            className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all disabled:opacity-50"
                        >
                            {passwordLoading ? "Updating..." : "Update Password"}
                        </button>
                    </div>
                )}
            </div>

            {/* ─── User Level Modal ─────────────────────────────────────────────── */}
            {isLevelModalOpen && editingLevelData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">{isNewLevel ? "Create User Level" : "Edit User Level"}</h3>
                            <button onClick={closeLevelModal} className="text-gray-400 hover:text-white transition-colors"><FiX className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-400 mb-1">Level ID (e.g., "gold")</label>
                                <input type="text" value={editingLevelData.id} onChange={(e) => setEditingLevelData({ ...editingLevelData, id: e.target.value.toLowerCase().trim() })} placeholder="Level ID" disabled={!isNewLevel}
                                    className={`w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-violet-500/50 ${!isNewLevel ? "opacity-50 cursor-not-allowed" : ""}`}
                                />
                                {!isNewLevel && <p className="text-[10px] text-gray-500 mt-1">Level ID cannot be changed once created</p>}
                            </div>
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold text-violet-400">Benefits</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    {([
                                        { label: "Max Orders", key: "maxOrder", type: "text" },
                                        { label: "Max Wallets", key: "maxWallets", type: "number" },
                                        { label: "Max EVM Wallets", key: "maxEVMWallets", type: "number" },
                                        { label: "Max SVM Wallets", key: "maxSVMWallets", type: "number" },
                                        { label: "Max Access Assets", key: "maxAccessAsset", type: "number" },
                                        { label: "Max Perp Agent Wallets", key: "maxPerpAgentWallet", type: "number" },
                                    ] as { label: string; key: keyof UserLevelEntry["benefits"]; type: string }[]).map(({ label, key, type }) => (
                                        <div key={key as string}>
                                            <label className="block text-[10px] text-gray-400 mb-1">{label}</label>
                                            <input type={type} value={(editingLevelData.benefits as any)[key]}
                                                onChange={(e) => setEditingLevelData({ ...editingLevelData, benefits: { ...editingLevelData.benefits, [key]: type === "number" ? (parseInt(e.target.value) || 0) : e.target.value } })}
                                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50" />
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 text-xs text-gray-300">
                                        <input type="checkbox"
                                            checked={editingLevelData.benefits.isDemoTestnet || false}
                                            onChange={(e) =>
                                                setEditingLevelData({
                                                    ...editingLevelData,
                                                    benefits: { ...editingLevelData.benefits, isDemoTestnet: e.target.checked },
                                                })
                                            }
                                            className="rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500"
                                        />
                                        Demo/Testnet Access
                                    </label>
                                    <label className="flex items-center gap-2 text-xs text-gray-300">
                                        <input
                                            type="checkbox"
                                            checked={editingLevelData.benefits.isTradeFeeExempt || false}
                                            onChange={(e) =>
                                                setEditingLevelData({
                                                    ...editingLevelData,
                                                    benefits: { ...editingLevelData.benefits, isTradeFeeExempt: e.target.checked },
                                                })
                                            }
                                            className="rounded border-white/10 bg-white/5 text-violet-500 focus:ring-violet-500"
                                        />
                                        Fee Exempt
                                    </label>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-[10px] text-gray-400 mb-1">Support Trading (comma separated)</label>
                                    <input
                                        type="text"
                                        value={editingLevelData.benefits.supportTrading?.join(", ") || ""}
                                        onChange={(e) =>
                                            setEditingLevelData({
                                                ...editingLevelData,
                                                benefits: {
                                                    ...editingLevelData.benefits,
                                                    supportTrading: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                                },
                                            })
                                        }
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="block text-[10px] text-gray-400 mb-1">Support Strategy (comma separated)</label>
                                    <input
                                        type="text"
                                        value={editingLevelData.benefits.supportStrategy?.join(", ") || ""}
                                        onChange={(e) =>
                                            setEditingLevelData({
                                                ...editingLevelData,
                                                benefits: {
                                                    ...editingLevelData.benefits,
                                                    supportStrategy: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                                                },
                                            })
                                        }
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50"
                                    />
                                </div>
                            </div>

                            {/* Requirements Section */}
                            <div>
                                <h4 className="text-sm font-semibold text-violet-400 mb-2">Requirements</h4>
                                <div className="space-y-2">
                                    {Object.entries(editingLevelData.requirements || {}).map(([key, req]) => (
                                        <div key={key} className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={key}
                                                placeholder="Requirement key (e.g. GLADIATOR_STAKE_43114)"
                                                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50"
                                                onChange={(e) => {
                                                    const newReqs = { ...editingLevelData.requirements };
                                                    const oldKey = key;
                                                    const value = newReqs[oldKey];
                                                    delete newReqs[oldKey];
                                                    newReqs[e.target.value] = value;
                                                    setEditingLevelData({ ...editingLevelData, requirements: newReqs });
                                                }}
                                            />
                                            <input
                                                type="text"
                                                value={req.quantity}
                                                placeholder="Quantity"
                                                className="w-28 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-violet-500/50"
                                                onChange={(e) => {
                                                    const newReqs = { ...editingLevelData.requirements };
                                                    newReqs[key] = { quantity: e.target.value };
                                                    setEditingLevelData({ ...editingLevelData, requirements: newReqs });
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newReqs = { ...editingLevelData.requirements };
                                                    delete newReqs[key];
                                                    setEditingLevelData({ ...editingLevelData, requirements: newReqs });
                                                }}
                                                className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                <FiX className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                    <button
                                        onClick={() => {
                                            const newReqs = { ...editingLevelData.requirements };
                                            const newKey = `REQUIREMENT_${Date.now()}`;
                                            newReqs[newKey] = { quantity: "0" };
                                            setEditingLevelData({ ...editingLevelData, requirements: newReqs });
                                        }}
                                        className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                                    >
                                        <FiPlus className="h-3 w-3" /> Add Requirement
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button
                                onClick={closeLevelModal}
                                className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-400 hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={saveUserLevel}
                                className="rounded-lg bg-gradient-to-r from-violet-600 to-cyan-500 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-violet-600/20 hover:shadow-violet-600/30 transition-all"
                            >
                                {isNewLevel ? "Create Level" : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── Chain Config Modal ──────────────────────────────────────────── */}
            {isChainModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold text-white">{editingChainIndex !== null ? "Edit Chain" : "Add Chain"}</h3>
                            <button onClick={closeChainModal} className="text-gray-400 hover:text-white transition-colors"><FiX className="h-5 w-5" /></button>
                        </div>
                        <div className="space-y-4">
                            {/* Basic Info */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Chain Name *</label>
                                    <input type="text" value={editingChain.name} onChange={(e) => setEditingChain({ ...editingChain, name: e.target.value })} placeholder="e.g. Arbitrum One" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Chain ID *</label>
                                    <input type="number" value={editingChain.chainId} onChange={(e) => setEditingChain({ ...editingChain, chainId: parseInt(e.target.value) || 0 })} placeholder="e.g. 42161" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Symbol</label>
                                    <input type="text" value={editingChain.symbol} onChange={(e) => setEditingChain({ ...editingChain, symbol: e.target.value })} placeholder="e.g. ETH" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                </div>
                                <div>
                                    <label className="block text-[10px] text-gray-400 mb-1">Network Type</label>
                                    <select value={editingChain.networkType} onChange={(e) => setEditingChain({ ...editingChain, networkType: e.target.value })} className="w-full rounded-lg border border-white/10 bg-gray-800 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50">
                                        <option value="mainnet">Mainnet</option>
                                        <option value="testnet">Testnet</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[10px] text-gray-400 mb-1">Image URL</label>
                                    <div className="flex items-center gap-2">
                                        {editingChain.imageUrl && (
                                            <img
                                                src={editingChain.imageUrl}
                                                alt="Preview"
                                                className="w-7 h-7 rounded-full object-contain bg-white/10 p-0.5 border border-white/10 shrink-0"
                                                onError={(e) => { (e.currentTarget.style.display = "none"); }}
                                            />
                                        )}
                                        <input
                                            type="text"
                                            value={editingChain.imageUrl || ""}
                                            onChange={(e) => setEditingChain({ ...editingChain, imageUrl: e.target.value })}
                                            placeholder="https://example.com/chain-logo.png"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Native Token */}
                            <div>
                                <h4 className="text-xs font-semibold text-cyan-400 mb-2">Native Token</h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1">Name</label>
                                        <input type="text" value={editingChain.nativeToken.name} onChange={(e) => setEditingChain({ ...editingChain, nativeToken: { ...editingChain.nativeToken, name: e.target.value } })} placeholder="e.g. Ether" className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1">Decimals</label>
                                        <input type="number" value={editingChain.nativeToken.decimals} onChange={(e) => setEditingChain({ ...editingChain, nativeToken: { ...editingChain.nativeToken, decimals: parseInt(e.target.value) || 18 } })} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-gray-400 mb-1">Address</label>
                                        <input type="text" value={editingChain.nativeToken.address} onChange={(e) => setEditingChain({ ...editingChain, nativeToken: { ...editingChain.nativeToken, address: e.target.value } })} placeholder="0x..." className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                    </div>
                                </div>
                            </div>

                            {/* Flags */}
                            <div className="flex items-center gap-6">
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input type="checkbox" checked={editingChain.isActive} onChange={(e) => setEditingChain({ ...editingChain, isActive: e.target.checked })} className="rounded border-white/10 bg-white/5 text-cyan-500" />
                                    Active
                                </label>
                                <label className="flex items-center gap-2 text-xs text-gray-300">
                                    <input type="checkbox" checked={editingChain.isPerpetual} onChange={(e) => setEditingChain({ ...editingChain, isPerpetual: e.target.checked })} className="rounded border-white/10 bg-white/5 text-cyan-500" />
                                    Supports Perpetual
                                </label>
                            </div>

                            {/* RPC URLs */}
                            <div>
                                <h4 className="text-xs font-semibold text-cyan-400 mb-2">RPC URLs</h4>
                                <div className="space-y-1.5 mb-2">
                                    {editingChain.rpcUrls.map((url, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="flex-1 text-xs font-mono text-gray-300 truncate">{url}</span>
                                            <button onClick={() => setEditingChain({ ...editingChain, rpcUrls: editingChain.rpcUrls.filter((_, j) => j !== i) })} className="p-1 text-gray-500 hover:text-red-400"><FiX className="h-3 w-3" /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" value={newRpcUrl} onChange={(e) => setNewRpcUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newRpcUrl.trim()) { setEditingChain({ ...editingChain, rpcUrls: [...editingChain.rpcUrls, newRpcUrl.trim()] }); setNewRpcUrl(""); } }} placeholder="https://rpc.example.com" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50" />
                                    <button onClick={() => { if (newRpcUrl.trim()) { setEditingChain({ ...editingChain, rpcUrls: [...editingChain.rpcUrls, newRpcUrl.trim()] }); setNewRpcUrl(""); } }} className="rounded-lg bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 transition-colors"><FiPlus className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>

                            {/* Private RPCs */}
                            <div>
                                <h4 className="text-xs font-semibold text-cyan-400 mb-2">Private RPCs</h4>
                                <div className="space-y-1.5 mb-2">
                                    {editingChain.privateRpcs.map((url, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <span className="flex-1 text-xs font-mono text-gray-300 truncate">{url}</span>
                                            <button onClick={() => setEditingChain({ ...editingChain, privateRpcs: editingChain.privateRpcs.filter((_, j) => j !== i) })} className="p-1 text-gray-500 hover:text-red-400"><FiX className="h-3 w-3" /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input type="text" value={newPrivateRpc} onChange={(e) => setNewPrivateRpc(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newPrivateRpc.trim()) { setEditingChain({ ...editingChain, privateRpcs: [...editingChain.privateRpcs, newPrivateRpc.trim()] }); setNewPrivateRpc(""); } }} placeholder="https://private-rpc.example.com" className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50" />
                                    <button onClick={() => { if (newPrivateRpc.trim()) { setEditingChain({ ...editingChain, privateRpcs: [...editingChain.privateRpcs, newPrivateRpc.trim()] }); setNewPrivateRpc(""); } }} className="rounded-lg bg-cyan-600/20 px-3 py-1.5 text-xs text-cyan-400 hover:bg-cyan-600/30 transition-colors"><FiPlus className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>

                            {/* Stable Tokens */}
                            <div>
                                <h4 className="text-xs font-semibold text-cyan-400 mb-2">Stable Tokens</h4>
                                <div className="space-y-1.5 mb-2">
                                    {editingChain.stableTokens.map((token, i) => (
                                        <div key={i} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-1.5">
                                            <span className="text-xs font-mono text-emerald-400 w-16">{token.symbol}</span>
                                            <span className="text-xs text-gray-500">d:{token.decimals}</span>
                                            <span className="flex-1 text-xs font-mono text-gray-500 truncate">{token.address}</span>
                                            <button onClick={() => setEditingChain({ ...editingChain, stableTokens: editingChain.stableTokens.filter((_, j) => j !== i) })} className="p-1 text-gray-500 hover:text-red-400"><FiX className="h-3 w-3" /></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="grid grid-cols-3 gap-2 mb-2">
                                    <input type="text" value={newStableToken.symbol} onChange={(e) => setNewStableToken({ ...newStableToken, symbol: e.target.value })} placeholder="Symbol (e.g. USDC)" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50" />
                                    <input type="number" value={newStableToken.decimals} onChange={(e) => setNewStableToken({ ...newStableToken, decimals: parseInt(e.target.value) || 18 })} placeholder="Decimals" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white outline-none focus:border-cyan-500/50" />
                                    <input type="text" value={newStableToken.address} onChange={(e) => setNewStableToken({ ...newStableToken, address: e.target.value })} placeholder="0x address" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white placeholder-gray-600 outline-none focus:border-cyan-500/50" />
                                </div>
                                <button
                                    onClick={() => {
                                        if (!newStableToken.symbol.trim()) return;
                                        setEditingChain({ ...editingChain, stableTokens: [...editingChain.stableTokens, { ...newStableToken }] });
                                        setNewStableToken({ symbol: "", decimals: 18, address: "" });
                                    }}
                                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                                >
                                    <FiPlus className="h-3 w-3" /> Add Stable Token
                                </button>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={closeChainModal} className="rounded-lg border border-white/10 px-4 py-2 text-xs text-gray-400 hover:bg-white/5 transition-colors">Cancel</button>
                            <button onClick={saveChainConfig} className="rounded-lg bg-gradient-to-r from-cyan-600 to-violet-600 px-4 py-2 text-xs font-medium text-white shadow-lg shadow-cyan-600/20 hover:shadow-cyan-600/30 transition-all">
                                {editingChainIndex !== null ? "Save Changes" : "Add Chain"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}