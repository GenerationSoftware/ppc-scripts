import { multicallBatchSize, rpcUrls, viemChains } from './config.js'
import {
  formatBigIntForDisplay,
  getBlockAtTimestamp,
  getNiceNetworkNameByChainId,
  getTokenPrices,
  NETWORK,
  prizePoolABI,
  vaultABI
} from '@generationsoftware/hyperstructure-client-js'
import { Address, Chain, ContractFunctionParameters, createPublicClient, formatEther, formatUnits, http, PublicClient } from 'viem'

export const getPublicClient = (network: NETWORK) => {
  const networkName = getNiceNetworkNameByChainId(network)

  const viemChain = viemChains[network as keyof typeof viemChains] as Chain | undefined
  if (!viemChain) throw new Error(`No viem chain found for ${networkName}`)

  const rpcUrl = rpcUrls[network as keyof typeof rpcUrls] as string | undefined
  if (!rpcUrl) throw new Error(`No RPC URL found for ${networkName}`)

  return createPublicClient({ chain: viemChain, transport: http(rpcUrl) })
}

export const getBlock = async (publicClient: PublicClient, timestamp?: number) => {
  const block = timestamp !== undefined ? await getBlockAtTimestamp(publicClient, BigInt(timestamp)) : await publicClient.getBlock()

  if (!block) {
    throw new Error(`Could not find block`)
  }

  return block
}

export const getPPC = async (publicClient: PublicClient, prizePoolAddress: Address, lastDrawId: number, options?: { blockNumber?: bigint }) => {
  const multicallResults = await publicClient.multicall({
    contracts: [
      { address: prizePoolAddress, abi: prizePoolABI, functionName: 'getTotalContributedBetween', args: [lastDrawId, lastDrawId] },
      { address: prizePoolAddress, abi: prizePoolABI, functionName: 'getTotalContributedBetween', args: [Math.max(0, lastDrawId - 6), lastDrawId] },
      { address: prizePoolAddress, abi: prizePoolABI, functionName: 'getTotalContributedBetween', args: [Math.max(0, lastDrawId - 29), lastDrawId] },
      { address: prizePoolAddress, abi: prizePoolABI, functionName: 'getTotalContributedBetween', args: [0, lastDrawId] }
    ],
    blockNumber: options?.blockNumber,
    batchSize: multicallBatchSize
  })

  const dailyPPC = multicallResults[0].result
  const weeklyPPC = multicallResults[1].result
  const monthlyPPC = multicallResults[2].result
  const totalPPC = multicallResults[3].result

  const avgWeeklyPPC = (weeklyPPC ?? 0n) / BigInt(Math.min(7, lastDrawId))
  const avgMonthlyPPC = (monthlyPPC ?? 0n) / BigInt(Math.min(30, lastDrawId))
  const avgTotalPPC = (totalPPC ?? 0n) / BigInt(lastDrawId)

  return {
    daily: { value: dailyPPC },
    weekly: { value: weeklyPPC, avg: avgWeeklyPPC },
    monthly: { value: monthlyPPC, avg: avgMonthlyPPC },
    total: { value: totalPPC, avg: avgTotalPPC }
  }
}

export const getTVL = async (network: NETWORK, publicClient: PublicClient, vaultAddresses: Address[], options?: { blockNumber?: bigint }) => {
  let tvl = 0

  const vaultTokens = await getVaultTokenData(publicClient, vaultAddresses, { blockNumber: options?.blockNumber })
  const tokenAddresses = vaultTokens.map((token) => token?.address).filter((address) => !!address) as Address[]

  const tokenPrices = await getTokenPrices(network, tokenAddresses)

  vaultTokens.forEach((token) => {
    if (!!token) {
      const tokenAddress = token.address.toLowerCase() as Lowercase<Address>
      const tokenPrice = tokenPrices[tokenAddress]

      if (!!tokenPrice) {
        const tokenBalance = parseFloat(formatUnits(token.balance, token.decimals))
        tvl += tokenBalance * tokenPrice
      }
    }
  })

  return tvl
}

export const getVaultTokenData = async (publicClient: PublicClient, vaultAddresses: Address[], options?: { blockNumber?: bigint }) => {
  const tokenData: ({ address: Address; balance: bigint; decimals: number } | undefined)[] = []

  if (!!vaultAddresses.length) {
    const contracts: ContractFunctionParameters<typeof vaultABI>[] = []
    vaultAddresses.forEach((address) =>
      contracts.push(
        { address, abi: vaultABI, functionName: 'asset' },
        { address, abi: vaultABI, functionName: 'totalAssets' },
        { address, abi: vaultABI, functionName: 'decimals' }
      )
    )

    // @ts-expect-error
    const results = await publicClient.multicall({ contracts, batchSize: multicallBatchSize, blockNumber: options?.blockNumber })

    for (let i = 0; i < vaultAddresses.length; i++) {
      const address = results[i * 3]?.result as Address | undefined
      const balance = results[i * 3 + 1]?.result as bigint | undefined
      const decimals = results[i * 3 + 2]?.result as number | undefined

      if (!!address && balance !== undefined && decimals !== undefined) {
        tokenData.push({ address, balance, decimals })
      } else {
        tokenData.push(undefined)
      }
    }
  }

  return tokenData
}

export const formatPPC = (ppc?: bigint) => {
  if (ppc === undefined) return '???'

  return `${formatBigIntForDisplay(ppc, 18)} ETH`
}

export const formatPrizeYield = (dailyPPC?: bigint, tvl?: number) => {
  if (dailyPPC === undefined || !tvl) return '???'

  return `${((parseFloat(formatEther(dailyPPC)) / tvl) * 365 * 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}
