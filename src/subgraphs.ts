import { NETWORK, SUBGRAPH_API_URLS } from '@generationsoftware/hyperstructure-client-js'
import { Address } from 'viem'

export const getPaginatedV5SubgraphVaultData = async (chainId: NETWORK, options?: { maxPageSize?: number }) => {
  const data: Awaited<ReturnType<typeof getV5SubgraphVaultData>> = []
  let lastVaultId = ''

  const maxVaultsPerPage = options?.maxPageSize ?? 100

  while (true) {
    const newPage = await getV5SubgraphVaultData(chainId, { maxVaultsPerPage, lastVaultId })

    data.push(...newPage)

    if (newPage.length < maxVaultsPerPage) {
      break
    } else {
      lastVaultId = newPage[newPage.length - 1].id
    }
  }

  return data
}

export const getV5SubgraphVaultData = async (chainId: NETWORK, options: { maxVaultsPerPage: number; lastVaultId?: string }) => {
  if (chainId in SUBGRAPH_API_URLS) {
    const subgraphUrl = SUBGRAPH_API_URLS[chainId as keyof typeof SUBGRAPH_API_URLS]

    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query($maxVaultsPerPage: Int, $lastVaultId: Bytes) {
          prizeVaults(first: $maxVaultsPerPage, where: { balance_gt: 0, id_gt: $lastVaultId }) {
            id
            address
            balance
          }
        }`,
        variables: {
          maxVaultsPerPage: options.maxVaultsPerPage,
          lastVaultId: options.lastVaultId ?? ''
        }
      })
    })

    const parsedResponse: { data?: { prizeVaults?: { id: string; address: string; balance: string }[] } } = (await response.json()) ?? {}
    const data = parsedResponse?.data?.prizeVaults ?? []

    const formattedData: { id: string; address: Address; balance: bigint }[] = data.map((entry) => ({
      id: entry.id,
      address: entry.address as Address,
      balance: BigInt(entry.balance)
    }))

    return formattedData
  } else {
    return []
  }
}
