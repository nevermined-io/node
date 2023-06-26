import { Injectable, NestMiddleware, Logger } from '@nestjs/common'

import { Request, Response, NextFunction } from 'express'

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP')

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl } = request

    this.logger.debug(`Req ${method} ${originalUrl}`)

    response.on('finish', () => {
      const { statusCode } = response

      this.logger.debug(`Res ${method} ${originalUrl} ${statusCode}`)
    })

    next()
  }
}
