import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common'
import { Request } from 'express'
import { ClientAssertion, parseJwt } from '../../helpers/jwt.utils'
import { BackendService } from '../../../shared/backend/backend.service'

@Injectable()
export class SessionKeyAuthGuard implements CanActivate {
  constructor(private backendService: BackendService) {}

  async canActivate(context: ExecutionContext) {
    try {
      const request = context.switchToHttp().getRequest()
      const req = context.switchToHttp().getRequest<Request<unknown>>()
      const clientAssertion: ClientAssertion = req.body
      const payload = await parseJwt(clientAssertion.client_assertion)
      request.payload = payload
      if (!clientAssertion.nvm_key_hash) {
        throw new Error('Invalid NVM API Key')
      }

      const nvmApiKey = await this.backendService.validateApiKey(clientAssertion.nvm_key_hash)
      if (!nvmApiKey) {
        throw new Error('Invalid NVM API Key')
      }
      if (nvmApiKey.userWallet !== payload.iss) {
        throw new Error('Invalid NVM API Key')
      }
      return true
    } catch (err: unknown) {
      Logger.error(err)
      return false
    }
  }
}
