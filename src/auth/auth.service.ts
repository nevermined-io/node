import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { JWTPayload } from 'jose';
import { LoginDto } from './dto/login.dto';
import { CLIENT_ASSERTION_TYPE, jwtEthVerify } from '../common/guards/shared/jwt.utils';
import { UserProfileService } from '../user-profiles/user-profile.service';
import { UserProfile } from '../user-profiles/user-profile.entity';
import { PermissionService } from '../permissions/permission.service';
import { ClientAssertionDto } from './dto/clientAssertion.dto';
import { State } from '../common/type';
import { Permission } from '../permissions/permission.entity';
import { ConditionState, Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from 'src/config';
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';

const BASE_URL = '/api/v1/gateway/services/'

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
      throw new UnauthorizedException('Invalid "client_assertion_type"');
    }

    let payload: JWTPayload;
    let userProfile: UserProfile;
    try {
      payload = jwtEthVerify(clientAssertion);
      const address = payload.iss;

      if (payload.aud === BASE_URL + 'access') {
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
