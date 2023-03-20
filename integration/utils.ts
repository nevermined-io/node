import { MetaData } from '@nevermined-io/sdk'

export const getMetadata = (): MetaData => {
  return {
    main: {
      name: 'test',
      type: 'dataset',
      dateCreated: new Date().toISOString(),
      datePublished: new Date().toISOString(),
      author: 'node',
      license: 'jest',
      files: [],
    },
  }
}
