import { Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class NeverminedGuard extends AuthGuard('nvm-login') {}
