declare global {
  namespace NodeJS {
    interface ProcessEnv {
      MAINNET_RPC_URL: string
      OPTIMISM_RPC_URL: string
      BASE_RPC_URL: string
      ARBITRUM_RPC_URL: string
    }
  }
}

export {}
