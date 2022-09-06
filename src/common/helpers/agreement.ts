import { BadRequestException, InternalServerErrorException, StreamableFile, UnauthorizedException } from '@nestjs/common';
import { Account, ConditionState, DDO, Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../../config';
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';
import { AgreementInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates';
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase';
import { decrypt } from './utils';
import download from 'download';
import AWS from 'aws-sdk';
// import fetch from 'node-fetch';
import { FormData } from 'formdata-node';
import { Blob } from 'buffer';

const _importDynamic = new Function('modulePath', 'return import(modulePath)')

async function fetch(...args) {
  const {default: fetch} = await _importDynamic('node-fetch')
  return fetch(...args)
}

export interface Template<T> {
  instanceFromDDO: (a: string, b: DDO, c: string, d: T) => Promise<AgreementInstance<T>>
}

export interface NormalCondition {
  fulfillInstance: (a: ConditionInstance<{}>, b: any, from: Account, params?: TxParameters, method?: string) => Promise<any>
  sendFrom: (name: string, args: any[], from: Account) => Promise<any>
}

export interface ConditionInfo {
  fulfill: boolean,
  condition?: NormalCondition,
  name: string,
  delegate?: boolean,
  extra?: any,
}

export interface Params<T> {
  nevermined: Nevermined,
  agreement_id: string, 
  did: string, 
  template: Template<T>,
  params: T,
  conditions: ConditionInfo[]
}

export async function getNevermined() {
  const nevermined = await Nevermined.getInstance(config)
  return nevermined
}

export async function validateAgreement<T>({
  nevermined,
  agreement_id, 
  did, 
  template,
  params,
  conditions,
}: Params<T>) {
  const ddo = await nevermined.assets.resolve(did)
  const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id)
  const agreementData = await template.instanceFromDDO(
    agreement.agreementIdSeed,
    ddo,
    agreement.creator,
    params
  )
  if (agreementData.agreementId !== agreement_id) {
    throw new UnauthorizedException(`Agreement doesn't match ${agreement_id} should be ${agreementData.agreementId}`)
  }
  const [from] = await nevermined.accounts.list()
  // Check that lock condition is fulfilled
  await Promise.all(conditions.map(async (a,idx) => {
    if (!a.fulfill) {
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[idx].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, ${a.name} condition ${agreementData.instances[idx].id} is not fulfilled`)
      }
    }
  }))
  for (let {idx, a} of conditions.map((a,idx) => ({idx, a}))) {
    if (a.fulfill) {
      const condInstance = agreementData.instances[idx] as ConditionInstance<{}>
      const method = a.delegate ? 'fulfillForDelegate' : 'fulfill'
      await a.condition.fulfillInstance(condInstance, a.extra || {}, from, undefined, method)
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[idx].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, ${a.name} condition ${agreementData.instances[idx].id} is not fulfilled`)
      }
    }
  }
}

export async function getAssetUrl(did: string, index: number): Promise<{url: string, content_type: string}> {
  const nevermined = await Nevermined.getInstance(config)
  // get url for DID
  const asset = await nevermined.assets.resolve(did)
  const service = asset.findServiceByType('metadata')
  const file_attributes = service.attributes.main.files[index]
  const content_type = file_attributes.contentType
  const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
  if (auth_method === 'RSAES-OAEP') {
    const filelist = JSON.parse(await decrypt(service.attributes.encryptedFiles, 'PSK-RSA'))
    // download url or what?
    const url: string = filelist[index].url
    return { url, content_type }
  }
  throw new BadRequestException()
}

const FILECOIN_GATEWAY = 'https://dweb.link/ipfs/:cid'

/*
Parses a url with the following formats:
cid://USER_TOKEN:DEAL_ID@ESTUARY_TOKEN/CID_HASH
cid://ESTUARY_TOKEN/CID_HASH
cid://USER_TOKEN:DEAL_ID@CID_HASH
cid://USER_TOKEN:@CID_HASH
cid://:DEAL_ID@CID_HASH
cid://CID_HASH
:param url: the cid url
:return: FilecoinUrl
*/
function parseUrl(url: string): string {
  url = url.replace(/^cid:\/\//, '')
  let parts = url.split(/[:@\/]/)
  return parts.pop()
}

export async function downloadAsset(did: string, index: number, res: any): Promise<StreamableFile> {
  try {
    let {url, content_type} = await getAssetUrl(did, index)
    if (!url) {
      throw new InternalServerErrorException(undefined, 'Bad URL')
    }
    // get url for DID
    if (url.startsWith('cid://')) {
      url = FILECOIN_GATEWAY.replace(':cid', parseUrl(url))
    }
    const param = url.split("/").slice(-1)[0]
    const filename = param.split("?")[0]
    const contents: Buffer = await download(url)
    res.set({
      'Content-Type': content_type,
      'Content-Disposition': `attachment;filename=${filename}`,
    });
    return new StreamableFile(contents)
  } catch (e) {
    if (e instanceof InternalServerErrorException) {
      throw e
    } else {
      throw new InternalServerErrorException(e.toString())
    }
  }
}

export async function uploadS3(file: Buffer, filename: string): Promise<string> {
  filename = filename || 'data'
  try {
    const s3 = new AWS.S3({
      accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
      endpoint: process.env.AWS_S3_ENDPOINT,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    })
    await s3.upload({
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: filename,
      Body: file,
    }).promise()
    const url = s3.getSignedUrl('getObject', {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: filename,
      Expires: 3600*24,
    })
    return url
  } catch (e) {
    throw new InternalServerErrorException(e.response)
  }
}

export async function uploadFilecoin(file: Buffer, filename: string): Promise<string> {
  try {
    const formData = new FormData()
    const blob = new Blob([file])
    formData.append('data', blob);
    const res = await fetch('https://shuttle-4.estuary.tech/content/add', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.ESTUARY_TOKEN}`,
      },
      body: formData as any
    })
    const obj = await res.json() as any
    if (obj.error) {
      throw new InternalServerErrorException(obj.error)
    }
    return 'cid://' + obj.cid
  } catch (e) {
    throw new InternalServerErrorException(e.response)
  }
}
