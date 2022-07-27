import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from 'jose';
import { LoginDto } from './dto/login.dto';
import { CLIENT_ASSERTION_TYPE, jwtEthVerify } from '../common/guards/shared/jwt.utils';
import { UserProfileService } from '../user-profiles/user-profile.service';
import { UserProfile } from '../user-profiles/user-profile.entity';
import { PermissionService } from '../permissions/permission.service';
// import { ClientAssertionDto } from './dto/clientAssertion.dto';
import { State } from '../common/type';
import { Permission } from '../permissions/permission.entity';
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
    private userProfileService: UserProfileService,
    private permissionService: PermissionService
  ) {}

  async validateAccess(agreement_id: string, did: string, consumer_address: string): Promise<LoginDto> {
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
      /*
      // Check that condition id seeds match with DDO
      const ddo = await nevermined.assets.resolve(did)
      const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id)
      const agreementData = await nevermined.keeper.templates.accessTemplate.instanceFromDDO(
        agreement.agreementIdSeed,
        ddo,
        agreement.creator,
        {
          consumerId: consumer_address,
          creator: agreement.creator,
          serviceType: 'access'
        }
      )
      if (agreementData.agreementId !== agreement_id) {
        throw new UnauthorizedException(`Agreement doesn't match ${agreement_id} should be ${agreementData.agreementId}`)
      }
      // Check that lock condition is fulfilled
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[1].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, lock condition ${agreementData.instances[1].id} is not fulfilled`)
      }
      // Fulfill access and escrow conditions
      const accessInstance = agreementData.instances[0] as ConditionInstance<{}>
      const escrowInstance = agreementData.instances[2] as ConditionInstance<{}>
      const [from] = await nevermined.accounts.list()
      await nevermined.keeper.conditions.accessCondition.fulfillInstance(accessInstance, {}, from)
      await nevermined.keeper.conditions.escrowPaymentCondition.fulfillInstance(escrowInstance, {}, from)
      const access_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[0].id)
      const escrow_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[2].id)
      if (access_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, access condition ${agreementData.instances[0].id} is not fulfilled`)
      }
      if (escrow_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, escrow condition ${agreementData.instances[2].id} is not fulfilled`)
      }
      */
      console.log('fulfilled agreement')
    }
    return {
      access_token: this.jwtService.sign({
        iss: consumer_address,
        sub: agreement_id,
        did: did,
      }),
    };
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
    let userProfile: UserProfile;
    try {
      payload = jwtEthVerify(clientAssertion);
      const address = payload.iss;

      console.log('validate access', payload)
      if (payload.aud === BASE_URL + 'access') {
        console.log('access url')
        return this.validateAccess(payload.sub, payload.did as string, payload.iss)
      }

      const userProfileSource = await this.userProfileService.findOneByAddress(address);

      if (!userProfileSource) {
        const userProfileEntity = new UserProfile();
        userProfileEntity.nickname = address;
        userProfileEntity.isListed = true;
        userProfileEntity.addresses = [address];
        userProfileEntity.state = State.Confirmed;
        userProfile = await this.userProfileService.createOne(userProfileEntity);
      } else {
        userProfile = userProfileSource._source;
      }

      const permission = await this.getPermission(userProfile.userId, address);

      console.log('making new token', payload)

      return {
        access_token: this.jwtService.sign({
          iss: address,
          sub: userProfile.userId,
          roles: permission?.type || [],
        }),
      };
    } catch (error) {
      throw new UnauthorizedException(`The 'client_assertion' is invalid: ${(error as Error).message}`);
    }
  }

  /*
  async validateNewAddressClaim(clientAssertionDto: ClientAssertionDto, userId: string): Promise<LoginDto> {
    if (clientAssertionDto.client_assertion_type !== CLIENT_ASSERTION_TYPE) {
      throw new UnauthorizedException('Invalid "client_assertion_type"');
    }

    try {
      const payload = jwtEthVerify(clientAssertionDto.client_assertion);
      const address = payload.iss;

      const userProfile = (await this.userProfileService.findOneById(userId))?._source;

      if (userProfile.addresses.some((a) => a === address)) {
        throw new UnauthorizedException(`The address ${address} already exists in ${userProfile.nickname} account`);
      }

      userProfile.addresses.push(address);

      const userProfileUpdated = (await this.userProfileService.updateOneByEntryId(userId, userProfile))?._source;

      const permission = await this.getPermission(userId, address);

      return {
        access_token: this.jwtService.sign({
          iss: address,
          sub: userProfileUpdated.userId,
          roles: permission?.type || [],
        }),
      };
    } catch (error) {
      throw new UnauthorizedException(`The 'client_assertion' is invalid: ${(error as Error).message}`);
    }
  }
  */

  private async getPermission(userId: string, address: string): Promise<Permission> {
    return (
      await this.permissionService.findManyByUserIdAndType(userId, undefined, {
        page: 1,
        offset: 100,
      })
    ).hits
      .map((p) => p._source)
      .find((p) => p.holder === address);
  }
}
