import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { TokenService } from './token.service.js';
import {
  AccessGuard,
  RolesGuard,
  AuthCsrfGuard,
  AuthRateGuard,
} from './auth.guards.js';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    AccessGuard,
    RolesGuard,
    AuthCsrfGuard,
    AuthRateGuard,
  ],
  exports: [AuthService, AccessGuard, RolesGuard],
})
export class AuthModule {}
