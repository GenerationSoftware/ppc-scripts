import { NETWORK } from '@generationsoftware/hyperstructure-client-js'
import 'dotenv/config'
import { Chain } from 'viem'
import { arbitrum, base, mainnet, optimism } from 'viem/chains'

export const viemChains = {
  [NETWORK.mainnet]: mainnet,
  [NETWORK.optimism]: optimism,
  [NETWORK.base]: base,
  [NETWORK.arbitrum]: arbitrum
} as const satisfies { [chainId: number]: Chain }

export const rpcUrls = {
  [NETWORK.mainnet]: process.env.MAINNET_RPC_URL,
  [NETWORK.optimism]: process.env.OPTIMISM_RPC_URL,
  [NETWORK.base]: process.env.BASE_RPC_URL,
  [NETWORK.arbitrum]: process.env.ARBITRUM_RPC_URL
} as const satisfies { [chainId: number]: string }

export const minStart = {
  [NETWORK.optimism]: { block: 118_900_269n, timestamp: 1_713_399_315 },
  [NETWORK.base]: { block: 14_506_826n, timestamp: 1_715_802_999 },
  [NETWORK.arbitrum]: { block: 216_345_461n, timestamp: 1_717_010_147 }
} as const satisfies { [chainId: number]: { block: bigint; timestamp: number } }

export const multicallBatchSize = 1_024 * 1_024
