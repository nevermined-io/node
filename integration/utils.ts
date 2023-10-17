import { MetaData } from '@nevermined-io/sdk'

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
