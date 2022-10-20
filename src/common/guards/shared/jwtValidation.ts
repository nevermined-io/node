import { ForbiddenException } from '@nestjs/common'
import jwt, { JsonWebTokenError } from 'jsonwebtoken'

export interface ITokenDecoded {
  exp: number;
  iat: number;
  sub: string;
}

export const jwtValidation = (props: { token: string; secret: string }): ITokenDecoded => {
  let token: string = props.token

  try {
    if (token.startsWith('Bearer ')) {
      token = token.slice(7, token.length)
    }
    return jwt.verify(token, props.secret) as ITokenDecoded
  } catch (ex) {
    throw new ForbiddenException((ex as JsonWebTokenError).message)
  }
}
