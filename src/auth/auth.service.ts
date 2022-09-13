import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from 'jose';
import { LoginDto } from './dto/login.dto';
import { CLIENT_ASSERTION_TYPE, jwtEthVerify } from '../common/guards/shared/jwt.utils';
// import { Account, Nevermined, Nft721 } from '@nevermined-io/nevermined-sdk-js';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
// import { getAssetUrl, validateAgreement } from '../common/helpers/agreement';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import { Dtp } from '@nevermined-io/nevermined-sdk-dtp/dist/Dtp';
// import { AccessProofConditionExtra } from '@nevermined-io/nevermined-sdk-dtp/dist/AccessProofCondition';
import { BabyjubPublicKey } from '@nevermined-io/nevermined-sdk-js/dist/node/models/KeyTransfer';
import { Babysig } from '@nevermined-io/nevermined-sdk-dtp/dist/KeyTransfer';
// import BigNumber from '@nevermined-io/nevermined-sdk-js/dist/node/utils/BigNumber';
import { ServiceType, ValidationParams } from '@nevermined-io/nevermined-sdk-js/dist/node/ddo/Service';

const BASE_URL = '/api/v1/gateway/services/';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    // private userProfileService: UserProfileService,
  ) {}


  async validateOwner(did: string, consumer_address: string): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const granted = await nevermined.keeper.conditions.accessCondition.checkPermissions(consumer_address, did);
    if (!granted) {
      throw new UnauthorizedException(`Address ${consumer_address} has no permission to access ${did}`);
    }
  }

  async validateAccess(params: ValidationParams, service: ServiceType): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const plugin = nevermined.assets.servicePlugin[service]
    const granted = await plugin.accept(params)
    if (!granted) {
      const [from] = await nevermined.accounts.list()
      await plugin.process(params, from, undefined)
    }
  }

  async validateTransferProof(agreement_id: string, did: string, consumer_address: string, buyer: string, babysig: Babysig): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const dtp = await Dtp.getInstance(instanceConfig);
    const buyerPub = new BabyjubPublicKey('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    if (!await dtp.keytransfer.verifyBabyjub(buyerPub, BigInt(consumer_address), babysig)) {
      throw new UnauthorizedException(`Bad signature for address ${consumer_address}`);
    }
  }

  /*

  async validateAccessProof(agreement_id: string, did: string, consumer_address: string, buyer: string, babysig: Babysig): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const dtp = await Dtp.getInstance(instanceConfig);
    const buyerPub = new BabyjubPublicKey('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    const consumer = await dtp.babyjubPublicAccount('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    const params = {
      consumerId: consumer_address,
      consumer,
    };
    const { url } = await getAssetUrl(did, 0);
    const data = Buffer.from(url, 'hex');
    const extra : AccessProofConditionExtra = {
      providerK: dtp.keytransfer.makeKey(process.env.PROVIDER_BABYJUB_SECRET),
      data
    };
    const conditions = [
      {name: 'access-proof', fulfill: true, condition: dtp.accessProofCondition, extra},
      {name: 'lock', fulfill: false},
      {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
    ];
    if (!await dtp.keytransfer.verifyBabyjub(buyerPub, BigInt(consumer_address), babysig)) {
      throw new UnauthorizedException(`Bad signature for address ${consumer_address}`);
    }
    await validateAgreement({
      agreement_id,
      nevermined,
      did,
      params,
      template: dtp.accessProofTemplate,
      conditions,
    });
  }

  async validateNft721AccessProof(agreement_id: string, did: string, consumer_address: string, buyer: string, babysig: Babysig): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const ddo = await nevermined.assets.resolve(did);
    const service = ddo.findServiceByType('nft721-access-proof');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const numberNfts = BigNumber.from(service.attributes.serviceAgreementTemplate.conditions[0].parameters[2].value);
    // eslint-disable-next-line
    const contractAddress: string = service.attributes.serviceAgreementTemplate.conditions[0].parameters[3].value;
    const nftContract = await Nft721.getInstance(
      (nevermined.keeper as any).instanceConfig, // eslint-disable-line
      contractAddress
    );
    if (agreement_id === '0x') {
      if (await nftContract.ownerOf(did) !== consumer_address) {
        throw new UnauthorizedException(`Address ${consumer_address} hasn't enough ${did} NFT balance`);
      }
      return;
    }
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const dtp = await Dtp.getInstance(instanceConfig);
    const buyerPub = new BabyjubPublicKey('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    const consumer = await dtp.babyjubPublicAccount('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    const { url } = await getAssetUrl(did, 0);
    const data = Buffer.from(url, 'hex');
    const extra : AccessProofConditionExtra = {
      providerK: dtp.keytransfer.makeKey(process.env.PROVIDER_BABYJUB_SECRET),
      data
    };
    if (!await dtp.keytransfer.verifyBabyjub(buyerPub, BigInt(consumer_address), babysig)) {
      throw new UnauthorizedException(`Bad signature for address ${consumer_address}`);
    }

    const params = dtp.nftAccessProofTemplate.params(consumer, consumer_address, numberNfts.toNumber());
    const conditions = [
      {name: 'holder', fulfill: false},
      {name: 'access', fulfill: true, condition: dtp.accessProofCondition, extra},
    ];
    await validateAgreement({
      agreement_id,
      did,
      nevermined,
      params,
      template: dtp.nftAccessProofTemplate,
      conditions,
    });
  }

  async validateNftAccessProof(agreement_id: string, did: string, consumer_address: string, buyer: string, babysig: Babysig): Promise<void> {
    const nevermined = await Nevermined.getInstance(config);
    const ddo = await nevermined.assets.resolve(did);
    const service = ddo.findServiceByType('nft-access-proof');
    if (!service) {
      await this.validateNft721AccessProof(agreement_id, did, consumer_address, buyer, babysig);
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const numberNfts = BigNumber.from(service.attributes.serviceAgreementTemplate.conditions[0].parameters[2].value);
    if (agreement_id === '0x') {
      if (await nevermined.keeper.nftUpgradeable.balance(consumer_address, did) < numberNfts) {
        throw new UnauthorizedException(`Address ${consumer_address} hasn't enough ${did} NFT balance, ${numberNfts.toString()} required`);
      }
      return;
    }
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    };
    const dtp = await Dtp.getInstance(instanceConfig);
    const consumer = await dtp.babyjubPublicAccount('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    const { url } = await getAssetUrl(did, 0);
    const data = Buffer.from(url, 'hex');
    const extra : AccessProofConditionExtra = {
      providerK: dtp.keytransfer.makeKey(process.env.PROVIDER_BABYJUB_SECRET),
      data
    };
    const buyerPub = new BabyjubPublicKey('0x'+buyer.substring(0,64), '0x'+buyer.substring(64,128));
    if (!await dtp.keytransfer.verifyBabyjub(buyerPub, BigInt(consumer_address), babysig)) {
      throw new UnauthorizedException(`Bad signature for address ${consumer_address}`);
    }

    const params = dtp.nftAccessProofTemplate.params(consumer, consumer_address, numberNfts.toNumber());
    const conditions = [
      {name: 'holder', fulfill: false},
      {name: 'access', fulfill: true, condition: dtp.accessProofCondition, extra},
    ];
    await validateAgreement({
      agreement_id,
      did,
      nevermined,
      params,
      template: dtp.nftAccessProofTemplate,
      conditions,
    });
  }*/

  /**
   * RFC-7523 Client Authentication https://datatracker.ietf.org/doc/html/rfc7523#section-2.2
   * RFC-8812 ECDSA Signature with secp256k1 Curve (ES256K)
   * https://www.rfc-editor.org/rfc/rfc8812#name-ecdsa-signature-with-secp25
   * This implementation is different from the standard in:
   * - the size of the signature. ethereum adds an extra byte to the signature to help
   * with recovering the public key that create the signature
   * - the hash function used. ES256K uses sha-256 while ethereum uses keccak
   **/
  async validateClaim(clientAssertionType: string, clientAssertion: string): Promise<LoginDto> {
    if (clientAssertionType !== CLIENT_ASSERTION_TYPE) {
      throw new UnauthorizedException('Invalid "assertion_type"');
    }

    let payload: JWTPayload;
    // let userProfile: UserProfile;
    try {
      payload = jwtEthVerify(clientAssertion);
      // const address = payload.iss;

      let params: ValidationParams = {
        consumer_address: payload.iss,
        did: '0x'+(payload.did as string).split(':')[2],
        agreement_id: payload.sub,
        buyer: payload.buyer as string, 
        babysig: payload.babysig as Babysig
      }

      if (payload.aud === BASE_URL + 'access') {
        await this.validateAccess(params, 'access');
      } /* else if (payload.aud === BASE_URL + 'access-proof') {
        await this.validateAccessProof(payload.sub, payload.did as string, payload.iss, payload.buyer as string, payload.babysig as Babysig);
      } else if (payload.aud === BASE_URL + 'nft-access-proof') {
        await this.validateNftAccessProof(payload.sub, payload.did as string, payload.iss, payload.buyer as string, payload.babysig as Babysig);
      } else if (payload.aud === BASE_URL + 'nft-transfer-proof') {
        await this.validateTransferProof(payload.sub, payload.did as string, payload.iss, payload.buyer as string, payload.babysig as Babysig);
      } */ else if (payload.aud === BASE_URL + 'download') {
        await this.validateOwner(payload.did as string, payload.iss);
      } else if (payload.aud === BASE_URL + 'nft-access') {
        await this.validateAccess(params, 'nft-access');
      }

      delete payload.exp;
      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch (error) {
      throw new UnauthorizedException(`The 'client_assertion' is invalid: ${(error as Error).message}`);
    }
  }

}
