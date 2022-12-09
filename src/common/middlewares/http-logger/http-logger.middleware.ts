import { Injectable, NestMiddleware, Logger } from '@nestjs/common'

import { Request, Response, NextFunction } from 'express'

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  private logger = new Logger('HTTP')

  use(request: Request, response: Response, next: NextFunction): void {
    const { method, originalUrl } = request

    this.logger.log(`Req ${method} ${originalUrl}`)

    response.on('finish', () => {
      const { statusCode } = response

      this.logger.log(`Res ${method} ${originalUrl} ${statusCode}`)
    })

    next()
  }
}
