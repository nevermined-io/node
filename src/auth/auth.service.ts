import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from 'jose';
import { LoginDto } from './dto/login.dto';
import { CLIENT_ASSERTION_TYPE, jwtEthVerify } from '../common/guards/shared/jwt.utils';
// import { UserProfileService } from '../user-profiles/user-profile.service';
// import { UserProfile } from '../user-profiles/user-profile.entity';
// import { ClientAssertionDto } from './dto/clientAssertion.dto';
// import { State } from '../common/type';
import { Account, ConditionState, DDO, Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../config';
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';
import { AgreementInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates';

const BASE_URL = '/api/v1/gateway/services/'

interface Template<T> {
  instanceFromDDO: (a: string, b: DDO, c: string, d: T) => Promise<AgreementInstance<T>>
}

interface NormalCondition {
  fulfillInstance: (a: ConditionInstance<{}>, b: {}, from: Account) => Promise<any>
}

interface ConditionInfo {
  fulfill: boolean,
  condition?: NormalCondition,
  name: string,
}

interface Params<T> {
  agreement_id: string, 
  did: string, 
  template: Template<T>,
  params: T,
  conditions: ConditionInfo[]
}

async function validateAgreement<T>({
  agreement_id, 
  did, 
  template,
  params,
  conditions,
}: Params<T>) {
  const nevermined = await Nevermined.getInstance(config)
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
      // console.log('fulfilling', a, idx)
      const condInstance = agreementData.instances[idx] as ConditionInstance<{}>
      await a.condition.fulfillInstance(condInstance, {}, from)
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[idx].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, ${a.name} condition ${agreementData.instances[idx].id} is not fulfilled`)
      }
    }
  }
}

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
    /*
    return {
      access_token: this.jwtService.sign({
        iss: consumer_address,
        sub: agreement_id,
        did: did,
      }),
    };*/
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
    /*
    return {
      access_token: this.jwtService.sign({
        iss: consumer_address,
        sub: agreement_id,
        did: did,
      }),
    };*/
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
        console.log('access url')
        await this.validateAccess(payload.sub, payload.did as string, payload.iss)
      } else if (payload.aud === BASE_URL + 'download') {
        console.log('access url')
        await this.validateOwner(payload.did as string, payload.iss)
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
