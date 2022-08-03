import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from 'jose';
import { LoginDto } from './dto/login.dto';
import { CLIENT_ASSERTION_TYPE, jwtEthVerify } from '../common/guards/shared/jwt.utils';
import { Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
import { validateAgreement } from '../common/helpers/agreement';
import { generateIntantiableConfigFromConfig } from '@nevermined-io/nevermined-sdk-js/dist/node/Instantiable.abstract';
import Dtp from '@nevermined-io/nevermined-sdk-dtp/dist/Dtp';

const BASE_URL = '/api/v1/gateway/services/'

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    // private userProfileService: UserProfileService,
  ) {}


  async validateOwner(did: string, consumer_address: string): Promise<void> {
    const nevermined = await Nevermined.getInstance(config)
    const granted = await nevermined.keeper.conditions.accessCondition.checkPermissions(consumer_address, did)
    if (!granted) {
      throw new UnauthorizedException(`Address ${consumer_address} has no permission to access ${did}`)
    }
  }

  async validateAccess(agreement_id: string, did: string, consumer_address: string): Promise<void> {
    const nevermined = await Nevermined.getInstance(config)
    const granted = await nevermined.keeper.conditions.accessCondition.checkPermissions(consumer_address, did)
    if (!granted) {
      const params = {
        consumerId: consumer_address,
        creator: (await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id)).creator,
        serviceType: 'access'
      }
      const conditions = [
        {name: 'access', fulfill: true, condition: nevermined.keeper.conditions.accessCondition},
        {name: 'lock', fulfill: false},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
      ]
      await validateAgreement({
        agreement_id,
        did,
        params,
        template: nevermined.keeper.templates.accessTemplate,
        conditions,
      })
      console.log('fulfilled agreement')
    }
  }

  async validateAccessProof(agreement_id: string, did: string, consumer_address: string, buyer: string, babysig: string): Promise<void> {
    const nevermined = await Nevermined.getInstance(config)
    const instanceConfig = {
      ...generateIntantiableConfigFromConfig(config),
      nevermined
    }
    const dtp = await Dtp.Dtp.getInstance(instanceConfig)
    const params = {
      consumerId: consumer_address,
      consumer: consumer_address,
    }
    const conditions = [
      {name: 'access', fulfill: true, condition: dtp.accessProofCondition},
      {name: 'lock', fulfill: false},
      {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
    ]
    await validateAgreement({
      agreement_id,
      did,
      params,
      template: dtp.accessProofTemplate,
      conditions,
    })
    console.log('fulfilled agreement')
  }

  async validateNftAccess(agreement_id: string, did: string, consumer_address: string): Promise<void> {
    const nevermined = await Nevermined.getInstance(config)
    const granted = await nevermined.keeper.conditions.nftAccessCondition.call<boolean>(
      'checkPermissions',
      [consumer_address, '0x'+did.split(':')[2]]
    )
    if (!granted) {
      const ddo = await nevermined.assets.resolve(did)
      const service = ddo.findServiceByType('nft-access')
      console.log('serive', JSON.stringify(service.attributes.serviceAgreementTemplate.conditions[0].parameters[2].value))
      const numberNfts = parseInt(service.attributes.serviceAgreementTemplate.conditions[0].parameters[2].value)
      if (agreement_id === '0x') {
        if (await nevermined.keeper.nftUpgradeable.balance(consumer_address, did) < numberNfts) {
          throw new UnauthorizedException(`Address ${consumer_address} hasn't enough ${did} NFT balance, ${numberNfts} required`)
        }
        return
      }
      const params =  nevermined.keeper.templates.nftAccessTemplate.params(consumer_address, numberNfts)
      const conditions = [
        {name: 'access', fulfill: true, condition: nevermined.keeper.conditions.nftAccessCondition},
        {name: 'lock', fulfill: false},
        {name: 'escrow', fulfill: true, condition: nevermined.keeper.conditions.escrowPaymentCondition},
      ]
      await validateAgreement({
        agreement_id,
        did,
        params,
        template: nevermined.keeper.templates.nftAccessTemplate,
        conditions,
      })
      console.log('fulfilled agreement')
    }
  }

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

      console.log('validate access', payload)
      if (payload.aud === BASE_URL + 'access') {
        await this.validateAccess(payload.sub, payload.did as string, payload.iss)
      } else if (payload.aud === BASE_URL + 'download') {
        await this.validateOwner(payload.did as string, payload.iss)
      } else if (payload.aud === BASE_URL + 'nft-access') {
        await this.validateNftAccess(payload.sub, payload.did as string, payload.iss)
      }

      console.log('making new token', payload)

      delete payload.exp
      return {
        access_token: this.jwtService.sign(payload),
      };
    } catch (error) {
      throw new UnauthorizedException(`The 'client_assertion' is invalid: ${(error as Error).message}`);
    }
  }

}
