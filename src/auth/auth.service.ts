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

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private userProfileService: UserProfileService,
    private permissionService: PermissionService
  ) {}

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

      console.log('making new token')

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
