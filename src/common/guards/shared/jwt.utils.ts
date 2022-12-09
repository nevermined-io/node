import {
  decodeJwt,
  decodeProtectedHeader,
  JWSHeaderParameters,
  JWTPayload,
  ProtectedHeaderParameters,
  SignJWT,
} from 'jose';
import { ethers } from 'ethers';

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:grant-type:jwt-bearer';

// TODO: Used only for testing and copied from the sdk
//       expose from the SDK side
export class EthSignJWT extends SignJWT {
  protectedHeader: JWSHeaderParameters;

  setProtectedHeader(protectedHeader: JWSHeaderParameters) {
    this.protectedHeader = protectedHeader;
    return this;
  }

  public async ethSign(wallet: ethers.Wallet): Promise<string> {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const encodedPayload = encoder.encode(this.base64url(JSON.stringify(this._payload)));
    const encodedHeader = encoder.encode(this.base64url(JSON.stringify(this.protectedHeader)));
    const data = this.concat(encodedHeader, encoder.encode('.'), encodedPayload);

    const sign = await wallet.signMessage(decoder.decode(data));

    const signed = this.base64url(ethers.utils.arrayify(sign));
    const grantToken = `${decoder.decode(encodedHeader)}.${decoder.decode(
      encodedPayload,
    )}.${signed}`;

    return grantToken;
  }

  private base64url(input: Uint8Array | string): string {
    return Buffer.from(input)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private concat(...buffers: Uint8Array[]): Uint8Array {
    const size = buffers.reduce((acc, { length }) => acc + length, 0);
    const buf = new Uint8Array(size);
    let i = 0;
    buffers.forEach((buffer) => {
      buf.set(buffer, i);
      i += buffer.length;
    });
    return buf;
  }
}

export const recoverPublicKey = (protectedHeader: string, payload: string, signature: string) => {
  const signatureInput = `${protectedHeader}.${payload}`;
  const signatureDecoded = `0x${Buffer.from(signature, 'base64').toString('hex')}`;

  const address = ethers.utils.verifyMessage(signatureInput, signatureDecoded);
  return ethers.utils.getAddress(address);
};

// TODO: A lot of this functionality should maybe be turned
//       into a passport strategy
// Verify a jwt with an ethereum signature
export const jwtEthVerify = (jwt: string) => {
  const { 0: protectedHeader, 1: payload, 2: signature, length } = jwt.split('.');

  if (length !== 3) {
    throw new Error('Invalid Compact JWS');
  }

  // decode and validate protected header
  let parsedProtectedHeader: ProtectedHeaderParameters;
  try {
    parsedProtectedHeader = decodeProtectedHeader(jwt);
  } catch (error) {
    throw new Error(`ProtectedHeader: Failed to decode header (${(error as Error).message})`);
  }
  if (parsedProtectedHeader.alg !== 'ES256K') {
    throw new Error('ProtectedHeader: Invalid algorithm');
  }

  // recover public key from signature
  // This is the de-facto signature validation
  let publicKey: string;
  try {
    publicKey = recoverPublicKey(protectedHeader, payload, signature);
  } catch (error) {
    throw new Error(`Signature: Failed to validate signature (${(error as Error).message})`);
  }

  // verify the payload
  let parsedPayload: JWTPayload;
  try {
    parsedPayload = decodeJwt(jwt);
  } catch (error) {
    throw new Error(`Payload: Failed to decode payload (${(error as Error).message})`);
  }
  if (!parsedPayload.iss) {
    throw new Error('Payload: "iss" field is required');
  }

  const isValidAddress = ethers.utils.isAddress(parsedPayload.iss);
  if (!isValidAddress) {
    throw new Error('Payload: "iss" field must be a valid ethereum address');
  }
  const isChecksumAddress = ethers.utils.getAddress(parsedPayload.iss) === parsedPayload.iss;
  if (!isChecksumAddress) {
    throw new Error('Payload: "iss" field must be a checksum address');
  }

  if (parsedPayload.iss !== publicKey) {
    throw new Error(`Payload: "iss" is not the signer of the payload ${publicKey}`);
  }

  return parsedPayload;
};
