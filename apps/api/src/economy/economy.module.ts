import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EconomyService } from './economy.service.js';
import { WalletController } from './wallet.controller.js';
import { WalletRateGuard } from './wallet-rate.guard.js';
@Module({
  imports: [AuthModule],
  providers: [EconomyService, WalletRateGuard],
  controllers: [WalletController],
  exports: [EconomyService],
})
export class EconomyModule {}
