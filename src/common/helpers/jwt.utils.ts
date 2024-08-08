import { Logger } from '@nestjs/common'
import { ethers } from 'ethers'
import * as jose from 'jose'

export interface ClientAssertion {
  client_assertion_type: string
  client_assertion: string
  nevermined_api_key?: string
}

export interface Eip712Data {
  message: string
  chainId: number
}

export const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'

export type JWTPayload = jose.JWTPayload
export class JwtEthVerifyError extends Error {}

export const parseJwt = async (jwt: string): Promise<JWTPayload> => {
  const { length } = jwt.split('.')

  if (length !== 3) {
    Logger.error('Invalid Compact JWS')
    throw new JwtEthVerifyError('Invalid Compact JWS')
  }

  // decode and validate protected header
  let parsedProtectedHeader: jose.ProtectedHeaderParameters
  try {
    parsedProtectedHeader = jose.decodeProtectedHeader(jwt)
  } catch (error) {
    Logger.error(`ProtectedHeader: Failed to decode header (${(error as Error).message})`)
    throw new JwtEthVerifyError(
      `ProtectedHeader: Failed to decode header (${(error as Error).message})`,
    )
  }
  if (parsedProtectedHeader.alg !== 'ES256K') {
    Logger.error('ProtectedHeader: Invalid algorithm')
    throw new JwtEthVerifyError('ProtectedHeader: Invalid algorithm')
  }

  // verify the payload
  let parsedPayload: JWTPayload
  try {
    parsedPayload = jose.decodeJwt(jwt)
  } catch (error) {
    Logger.error(`Payload: Failed to decode payload (${(error as Error).message})`)
    throw new JwtEthVerifyError(`Payload: Failed to decode payload (${(error as Error).message})`)
  }
  if (!parsedPayload.iss) {
    Logger.error('Payload: "iss" field is required')
    throw new JwtEthVerifyError('Payload: "iss" field is required')
  }

  const isValidAddress = ethers.isAddress(parsedPayload.iss)
  if (!isValidAddress) {
    Logger.error('Payload: "iss" field must be a valid ethereum address')
    throw new JwtEthVerifyError('Payload: "iss" field must be a valid ethereum address')
  }
  const isChecksumAddress = ethers.getAddress(parsedPayload.iss) === parsedPayload.iss
  if (!isChecksumAddress) {
    Logger.error('Payload: "iss" field must be a checksum address')
    throw new JwtEthVerifyError('Payload: "iss" field must be a checksum address')
  }

  return parsedPayload
}
