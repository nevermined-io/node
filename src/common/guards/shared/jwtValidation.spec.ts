import { ForbiddenException } from '@nestjs/common'
import { advanceBy, advanceTo } from 'jest-date-mock'
import jwt from 'jsonwebtoken'
import { jwtValidation } from './jwtValidation'

describe('JwtValidation', () => {
  let token: string
  const dayMilliseconds = 1000 * 60 * 60 * 24

  beforeAll(() => {
    const mockedNow = new Date(Date.UTC(2019, 3, 20, 0, 0, 0))
    advanceTo(mockedNow)

    token = jwt.sign(
      {
        exp: advanceBy(dayMilliseconds),
        iat: mockedNow.getUTCMilliseconds(),
        sub: '12345',
      },
      'secret'
    )
  })
  it('should decode the token', () => {
    const decoded = jwtValidation({
      secret: 'secret',
      token,
    })

    expect(decoded.sub).toBe('12345')
  })

  it('should throw error for invalid token', () => {
    const anotherToken = token.slice(0, -1)

    expect(() =>
      jwtValidation({
        secret: 'secret',
        token: anotherToken,
      })
    ).toThrowError(new ForbiddenException('invalid signature'))
  })

  it('should accept Bearer token', () => {
    const bearerToken = `Bearer ${token}`

    const decoded = jwtValidation({
      secret: 'secret',
      token: bearerToken,
    })

    expect(decoded.sub).toBe('12345')
  })

  it('should throw token expired', () => {
    const mockedNow = new Date(Date.UTC(2019, 3, 20, 0, 0, 0))
    advanceTo(mockedNow)

    token = jwt.sign(
      {
        exp: mockedNow.getUTCMilliseconds() + dayMilliseconds,
        iat: mockedNow.getUTCMilliseconds(),
        sub: '12345',
      },
      'secret'
    )

    advanceBy(dayMilliseconds * 2)

    expect(() =>
      jwtValidation({
        secret: 'secret',
        token,
      })
    ).toThrowError(new ForbiddenException('jwt expired'))
  })
})
