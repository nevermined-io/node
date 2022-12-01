import { Injectable, NestMiddleware } from '@nestjs/common'
import { Request, Response } from 'express'
import { ConfigService } from '../../../shared/config/config.service'

@Injectable()
export class HttpsRedirectMiddleware implements NestMiddleware {
  private enableSecure

  constructor(configService: ConfigService) {
    this.enableSecure = configService.get('security.enableHttpsRedirect')
  }
  use(req: Request, res: Response, next: () => void) {
    if (this.enableSecure && !req.secure) {
      res.redirect(`https://${req.hostname}${req.originalUrl}`)
    } else {
      next()
    }
  }
}
