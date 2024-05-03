import { MetaData, Nevermined, NvmAccount, generateId, zeroPadValue } from '@nevermined-io/sdk'

export const getMetadata = (nonce: string | number = Math.random(), name = 'test'): MetaData => {
  return {
    main: {
      name,
      ...({ nonce } as any),
      type: 'dataset',
      dateCreated: new Date().toISOString(),
      datePublished: new Date().toISOString(),
      author: 'node',
      license: 'jest',
      files: [],
    },
  }
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function mineBlocks(
  nevermined: Nevermined,
  account: NvmAccount,
  blocksToWait: number,
) {
  for (let index = 0; index < blocksToWait; index++) {
    console.debug(`Mining block ${index}`)
    await nevermined.provenance.used(
      generateId(),
      generateId(),
      account.getId(),
      account.getId(),
      zeroPadValue('0x', 32),
      `miningBlock${index}`,
      account,
    )
    await sleep(100)
  }
}
