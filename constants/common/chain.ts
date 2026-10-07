export let chains: any = {
  Avalanche: 43114,
  Arbitrum: 42161,
  Ethereum: 1,
  Solana: 1399811149
};

export let chainConfig: any = {
  [chains.Arbitrum]: {
    rpcUrls: [
      "https://arb1.arbitrum.io/rpc",
      "https://arbitrum-one-rpc.publicnode.com",
    ],
    explorerUrl: "https://arbiscan.io/",
    chainId: 42161,
    name: "ARBITRUM",
    symbol: "ETH",
    nativeToken: {
      name: "WETH",
      decimals: 18,
      address: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    },
    imageUrl: `https://arbitrum.io/arb_logo_color.svg`,
    isPerpetual: true,
    isActive: true,
  },
};

export const isValidChain = (chainId: Number) => {
  return chainConfig[chainId as number].isActive === true
}


export const updateNetworkConfig = (systemChainConfigs: any) => {
  if (!systemChainConfigs || systemChainConfigs.length == 0) {
    return
  }
  chainConfig = systemChainConfigs.reduce((acc: any, chainInfo: any) => {
    acc[chainInfo.chainId] = chainInfo
    chains[chainInfo.name] = chainInfo.chainId
    return acc
  }, {})

}


