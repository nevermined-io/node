import { Injectable } from '@nestjs/common';
import { Dtp } from '@nevermined-io/nevermined-sdk-dtp/dist/Dtp';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { DDO, MetaDataMain, Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { utils } from '@nevermined-io/nevermined-sdk-js';
import { BadRequestException, InternalServerErrorException, NotFoundException, StreamableFile } from '@nestjs/common';
import AWS from 'aws-sdk';
import { FormData } from 'formdata-node';
import { Blob } from 'buffer';
import { Logger } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';
import { decrypt } from '@nevermined-io/nevermined-sdk-dtp';
import { ethers } from 'ethers';
import { didZeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils';
import { HttpModuleOptions, HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const _importDynamic = new Function('modulePath', 'return import(modulePath)');

async function fetch(...args) {
  const { default: fetch } = await _importDynamic('node-fetch');
  return fetch(...args);
}

@Injectable()
export class NeverminedService {
  nevermined: Nevermined;
  dtp: Dtp;
  constructor(private config: ConfigService, private readonly httpService: HttpService) {}
  // TODO: handle configuration properly
  async onModuleInit() {
    const config = this.config.nvm();
    this.nevermined = await Nevermined.getInstance(config);
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined: this.nevermined,
    };
    this.dtp = await Dtp.getInstance(instanceConfig, this.config.cryptoConfig());
  }
  getNevermined() {
    return this.nevermined;
  }
  getDtp() {
    return this.dtp;
  }
  instanceConfig() {
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(this.config.nvm()),
      nevermined: this.nevermined,
    };
    return instanceConfig;
  }
  web3ProviderUri(): string {
    return this.config.nvm().web3ProviderUri;
  }

  async getAssetUrl(did: string, index: number): Promise<{ url: string; content_type: string; dtp: boolean }> {
    // get url for DID
    let asset: DDO;
    try {
      asset = await this.nevermined.assets.resolve(did);
    } catch (e) {
      Logger.error(`Cannot resolve DID ${did}`);
      throw new BadRequestException(`No such DID ${did}`);
    }
    const service = asset.findServiceByType('metadata');
    const file_attributes = service.attributes.main.files[index];
    const content_type = file_attributes.contentType;
    const auth_method = asset.findServiceByType('authorization').service || 'RSAES-OAEP';
    if (auth_method === 'RSAES-OAEP') {
      const filelist = JSON.parse(
        await decrypt(this.config.cryptoConfig(), service.attributes.encryptedFiles, 'PSK-RSA')
      );
      // download url or what?
      const url: string = filelist[index].url;
      return { url, content_type, dtp: this.isDTP(service.attributes.main) };
    }
    Logger.error(`Auth METHOD wasn't RSAES-OAEP`);
    throw new BadRequestException();
  }

  async downloadAsset(did: string, index: number, res: any, userAddress: string): Promise<StreamableFile | string> {
    Logger.debug(`Downloading asset from ${did} index ${index}`);
    try {
      // eslint-disable-next-line prefer-const
      let { url, content_type, dtp } = await this.getAssetUrl(did, index);
      if (!url) {
        Logger.error(`URL for did ${did} not found`);
        throw new NotFoundException(`URL for did ${did} not found`);
      }
      if (dtp && !url.startsWith('cid://') && !url.startsWith('http')) {
        return url;
      }
      Logger.debug(`Serving URL ${url}`);

      const param = url.split('/').slice(-1)[0];
      const filename = param.split('?')[0];

      let response;

      // Download from filecoin or ipfs
      if (url.startsWith('cid://')) {
        const ipfsProjectId = this.config.get<string>('IPFS_PROJECT_ID');
        const ipfsProjectSecret = this.config.get<string>('IPFS_PROJECT_SECRET');

        const cid = url.replace('cid://', '');
        url = `${this.config.get<string>('IPFS_GATEWAY')}/api/v0/cat?arg=${cid}`;

        const config: HttpModuleOptions = {
          url: `${this.config.get<string>('IPFS_GATEWAY')}/api/v0/cat`,
          method: 'POST',
          responseType: 'arraybuffer',
          auth: {
            username: ipfsProjectId,
            password: ipfsProjectSecret,
          },
          params: {
            arg: cid,
          },
        };

        response = await firstValueFrom(this.httpService.request(config));
      } else {
        const config: HttpModuleOptions = {
          responseType: 'arraybuffer',
        };
        response = await firstValueFrom(this.httpService.get(url, config));
      }

      const contents: Buffer = response.data;

      try {
        if (this.config.get<boolean>('ENABLE_PROVENANCE')) {
          const [from] = await this.nevermined.accounts.list();
          const provId = utils.generateId();
          await this.nevermined.provenance.used(
            provId,
            didZeroX(did),
            userAddress,
            utils.generateId(),
            ethers.utils.hexZeroPad('0x0', 32),
            'download',
            from
          );
          Logger.debug(`Provenance: USED event Id (${provId}) for DID ${did} registered`);
        }
      } catch (error) {
        Logger.warn(`Unable to register on-chain provenance: ${error.toString()}`);
      }

      res.set({
        'Content-Type': content_type,
        'Content-Disposition': `attachment;filename=${filename}`,
      });
      return new StreamableFile(contents);
    } catch (e) {
      if (e instanceof NotFoundException) {
        Logger.error(e);
        throw e;
      } else {
        Logger.error(e);
        throw new InternalServerErrorException(e.toString());
      }
    }
  }

  async uploadS3(file: Buffer, filename: string): Promise<string> {
    Logger.debug(`Uploading to S3 ${filename}`);
    filename = filename || 'data';
    try {
      const s3 = new AWS.S3({
        accessKeyId: this.config.get('AWS_S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('AWS_S3_SECRET_ACCESS_KEY'),
        endpoint: this.config.get('AWS_S3_ENDPOINT'),
        s3ForcePathStyle: true,
        signatureVersion: 'v4',
      });
      await s3
        .upload({
          Bucket: this.config.get('AWS_S3_BUCKET_NAME'),
          Key: filename,
          Body: file,
        })
        .promise();
      const url = s3.getSignedUrl('getObject', {
        Bucket: this.config.get('AWS_S3_BUCKET_NAME'),
        Key: filename,
        Expires: 3600 * 24,
      });
      return url;
    } catch (e) {
      Logger.error(`Uploading ${filename}: AWS error ${e.response}`);
      throw new InternalServerErrorException(e.response);
    }
  }

  async uploadFilecoin(file: Buffer, filename: string): Promise<string> {
    try {
      Logger.debug(`Uploading to filecoin ${filename}`);
      const formData = new FormData();
      const blob = new Blob([file]);
      formData.append('data', blob);
      const res = await fetch(this.config.get('ESTUARY_ENDPOINT'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.get('ESTUARY_TOKEN')}`,
        },
        body: formData as any,
      });
      const obj = (await res.json()) as any;
      if (obj.error) {
        throw new InternalServerErrorException(obj.error);
      }
      return 'cid://' + obj.cid;
    } catch (e) {
      Logger.error(`Uploading ${filename}: Filecoin error ${e.response}`);
      throw new InternalServerErrorException(e.response);
    }
  }

  private isDTP(main: MetaDataMain): boolean {
    return main.files && main.files.some((f) => f.encryption === 'dtp');
  }
}
