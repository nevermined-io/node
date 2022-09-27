import { Injectable } from '@nestjs/common';
import { Dtp } from '@nevermined-io/nevermined-sdk-dtp/dist/Dtp';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../../config';
import { BadRequestException, InternalServerErrorException, NotFoundException, StreamableFile } from '@nestjs/common';
import { decrypt } from '../../common/helpers/utils';
import download from 'download';
import AWS from 'aws-sdk';
import { FormData } from 'formdata-node';
import { Blob } from 'buffer';
import { Logger } from '../logger/logger.service';

const _importDynamic = new Function('modulePath', 'return import(modulePath)')

async function fetch(...args) {
  const {default: fetch} = await _importDynamic('node-fetch')
  return fetch(...args)
}

function parseUrl(url: string): string {
    url = url.replace(/^cid:\/\//, '')
    let parts = url.split(/[:@\/]/)
    return parts.pop()
}

const FILECOIN_GATEWAY = 'https://dweb.link/ipfs/:cid'

@Injectable()
export class NeverminedService {
    nevermined: Nevermined;
    // TODO: handle configuration properly
    async onModuleInit() {
        this.nevermined = await Nevermined.getInstance(config);
        const instanceConfig = {
            ...generateIntantiableConfigFromConfig(config),
            nevermined: this.nevermined,
        };
        await Dtp.getInstance(instanceConfig);
    }
    getNevermined() {
        return this.nevermined
    }
    async getAssetUrl(did: string, index: number): Promise<{url: string, content_type: string, dtp: boolean}> {
        // get url for DID
        const asset = await this.nevermined.assets.resolve(did)
        const service = asset.findServiceByType('metadata')
        const file_attributes = service.attributes.main.files[index]
        const content_type = file_attributes.contentType
        const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP'
        if (auth_method === 'RSAES-OAEP') {
            const filelist = JSON.parse(await decrypt(service.attributes.encryptedFiles, 'PSK-RSA'))
            // download url or what?
            const url: string = filelist[index].url
            return { url, content_type, dtp: service.attributes.main.isDTP }
        }
        Logger.error(`Auth METHOD wasn't RSAES-OAEP`)
        throw new BadRequestException()
    }

    async downloadAsset(did: string, index: number, res: any): Promise<StreamableFile|string> {
        Logger.debug(`Downloading asset from ${did} index ${index}`)
        try {
            let {url, content_type, dtp} = await this.getAssetUrl(did, index)
            if (dtp) {
                return url
            }
            if (!url) {
                Logger.error(`URL for did ${did} not found`)
                throw new NotFoundException(`URL for did ${did} not found`)
            }
            Logger.debug(`Serving URL ${url}`)
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
            if (e instanceof NotFoundException) {
                throw e
            } else {
                Logger.error(``)
                throw new InternalServerErrorException(e.toString())
            }
        }
    }

    async uploadS3(file: Buffer, filename: string): Promise<string> {
        Logger.debug(`Uploading to S3 ${filename}`)
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
            Logger.error(`Uploading ${filename}: AWS error ${e.response}`)
            throw new InternalServerErrorException(e.response)
        }
    }
      
    async uploadFilecoin(file: Buffer, filename: string): Promise<string> {
        try {
            Logger.debug(`Uploading to filecoin ${filename}`)
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
            Logger.error(`Uploading ${filename}: Filecoin error ${e.response}`)
            throw new InternalServerErrorException(e.response)
        }
    }
      
}

