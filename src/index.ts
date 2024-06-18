import { minStart } from './config.js'
import { getPaginatedV5SubgraphVaultData } from './subgraphs.js'
import { formatPPC, formatPrizeYield, getBlock, getPPC, getPublicClient, getTVL } from './utils.js'
import {
  formatBigIntForDisplay,
  formatNumberForDisplay,
  getNiceNetworkNameByChainId,
  getSecondsSinceEpoch,
  getSimpleDate,
  NETWORK,
  PRIZE_POOLS,
  prizePoolABI,
  SECONDS_PER_MONTH,
  SECONDS_PER_WEEK
} from '@generationsoftware/hyperstructure-client-js'

interface StartParams {
  network: NETWORK
  timestamp?: number
}

const start = async ({ network, timestamp }: StartParams) => {
  console.info(`  =============== ${getNiceNetworkNameByChainId(network)} Stats ===============\n`)

  const prizePoolInfo = PRIZE_POOLS.find((pool) => pool.chainId === network)

  if (!prizePoolInfo) {
    throw new Error(`No prize pool found on ${getNiceNetworkNameByChainId(network)}`)
  }

  const publicClient = getPublicClient(network)

  const currentTimestamp = getSecondsSinceEpoch()
  if (timestamp !== undefined && timestamp > currentTimestamp) {
    throw new Error(`Timestamp provided is in the future`)
  }

  const minTimestamp = minStart[network as keyof typeof minStart]?.timestamp ?? 0
  if (timestamp !== undefined && timestamp <= minTimestamp) {
    throw new Error(`Timestamp provided is too early (before ${getSimpleDate(minTimestamp)})`)
  }

  console.info(`  > Timestamp: ${formatNumberForDisplay(timestamp ?? currentTimestamp)}`)

  const block = await getBlock(publicClient, timestamp)
  console.info(`  > Block: ${formatBigIntForDisplay(block.number, 0)}`)

  const lastDrawId = await publicClient.readContract({
    address: prizePoolInfo.address,
    abi: prizePoolABI,
    functionName: 'getLastAwardedDrawId',
    blockNumber: block.number
  })
  console.info(`  > Draw ID: ${lastDrawId}`)

  // TODO: this is querying current vaults; should have a way to pickup any past vaults
  const vaults = await getPaginatedV5SubgraphVaultData(network)
  const vaultAddresses = vaults.map((vault) => vault.address)
  console.info(`  > Vaults: ${vaultAddresses.length}`)

  const ppc = await getPPC(publicClient, prizePoolInfo.address, lastDrawId, { blockNumber: block.number })

  const timestampLastWeek = (timestamp ?? currentTimestamp) - SECONDS_PER_WEEK
  const timestampLastMonth = (timestamp ?? currentTimestamp) - SECONDS_PER_MONTH

  const blockLastWeek = timestampLastWeek > minTimestamp ? await getBlock(publicClient, timestampLastWeek) : undefined
  const blockLastMonth = timestampLastMonth > minTimestamp ? await getBlock(publicClient, timestampLastMonth) : undefined

  console.info('')
  const tvlNow = await getTVL(network, publicClient, vaultAddresses, { blockNumber: block.number })
  console.info(`  > TVL:              ${formatNumberForDisplay(tvlNow)} ETH`)
  const tvlLastWeek = !!blockLastWeek ? await getTVL(network, publicClient, vaultAddresses, { blockNumber: blockLastWeek.number }) : 0
  console.info(`  > TVL (Last Week):  ${formatNumberForDisplay(tvlLastWeek)} ETH`)
  const tvlLastMonth = !!blockLastMonth ? await getTVL(network, publicClient, vaultAddresses, { blockNumber: blockLastMonth.number }) : 0
  console.info(`  > TVL (Last Month): ${formatNumberForDisplay(tvlLastMonth)} ETH`)

  const avgTvlLastWeek = !!tvlLastWeek ? (tvlNow + tvlLastWeek) / 2 : 0
  const avgTvlLastMonth = !!tvlLastMonth ? (tvlNow + tvlLastMonth) / 2 : 0

  console.info('')
  console.info(`  > Daily PPC:                  ${formatPPC(ppc.daily.value)}`)
  console.info(`  > Avg Daily PPC (Last Week):  ${formatPPC(ppc.weekly.avg)} (Total ${formatPPC(ppc.weekly.value)})`)
  console.info(`  > Avg Daily PPC (Last Month): ${formatPPC(ppc.monthly.avg)} (Total ${formatPPC(ppc.monthly.value)})`)
  console.info(`  > Avg Daily PPC (All Time):   ${formatPPC(ppc.total.avg)} (Total ${formatPPC(ppc.total.value)})`)
  console.info('')
  console.info(`  > Daily Prize Yield:                  ${formatPrizeYield(ppc.daily.value, tvlNow)}`)
  console.info(`  > Avg Daily Prize Yield (Last Week):  ${formatPrizeYield(ppc.weekly.avg, avgTvlLastWeek)}`)
  console.info(`  > Avg Daily Prize Yield (Last Month): ${formatPrizeYield(ppc.monthly.avg, avgTvlLastMonth)}`)
  console.info('\n')
}

/**
 * Edit the start function call to query different networks or timestamps.
 * If a timestamp is not provided, the current timestamp will be used.
 */
start({ network: NETWORK.optimism })
  .then(() => start({ network: NETWORK.base }))
  .then(() => start({ network: NETWORK.arbitrum }))
