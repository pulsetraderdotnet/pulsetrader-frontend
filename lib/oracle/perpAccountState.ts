import { nativeFetchRequest } from "./fetchRequest"


export const getHyperliquidAvailableBalance = async (userAddress: string) => {
    const state = await nativeFetchRequest({
        url: 'https://api.hyperliquid.xyz/info',
        method: 'POST',
        data: {
            type: "clearinghouseState",
            user: userAddress,
        },
    });
    console.log("state", state)
    if (!state) return;
    return parseFloat(state.withdrawable)
}

export const getHyperliquidTestnetAvailableBalance = async (userAddress: string) => {
    const state = await nativeFetchRequest({
        url: 'https://api.hyperliquid-testnet.xyz/info',
        method: 'POST',
        data: {
            type: "spotClearinghouseState",
            user: userAddress,
        },
    });
    if (!state) return;
    const availableValue = parseFloat(state?.tokenToAvailableAfterMaintenance?.[0]?.[1])
    return availableValue;
}

export const getHyperAccountState = async (userAddress: string, isMainnet: boolean) => {
    try {
        const url = isMainnet ? 'https://api.hyperliquid.xyz/info' : 'https://api.hyperliquid-testnet.xyz/info';
        // Try webData3 first (gives cumLedger = equity)
        const [accountState, spotClearingBalance] = await Promise.all([nativeFetchRequest({
            url,
            method: 'POST',
            data: {
                type: "clearinghouseState",
                user: userAddress,
            },
        }), nativeFetchRequest({
            url,
            method: 'POST',
            data: {
                type: "spotClearinghouseState",
                user: userAddress,
            },
        })]);


        const accountValue = spotClearingBalance.balances.reduce((acc: any, bal: any) => acc + parseFloat(bal.total), 0) || parseFloat(accountState.marginSummary.accountValue) || 0;
        const totalMargin = parseFloat(accountState.marginSummary.totalMarginUsed) || 0;
        const availableValue = parseFloat(spotClearingBalance?.tokenToAvailableAfterMaintenance?.[0]?.[1]) || parseFloat(accountState.withdrawable) || accountValue - totalMargin;

        return availableValue;
    } catch (err) {
        return 0
    }
};





export const getPerpExchangeAvailableBalance = async (userAddress: string, exchange: string, isMainnet: boolean) => {
    if (exchange == 'hyperliquid') {
        return getHyperAccountState(userAddress, isMainnet)
    }
}