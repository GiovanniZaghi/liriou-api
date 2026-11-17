import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthModule } from '../auth/auth.module'
import {
  ExportLeadsUseCase,
  GetLeadStatsUseCase,
  JoinVipListUseCase,
  ListLeadsUseCase,
} from './application/leads.use-cases'
import { LeadRepository } from './domain/lead.repository'
import { LeadOrmEntity } from './infra/lead.orm-entity'
import { TypeOrmLeadRepository } from './infra/typeorm-lead.repository'
import { AdminLeadsController, LeadsController } from './presentation/http/leads.controller'

@Module({
  imports: [TypeOrmModule.forFeature([LeadOrmEntity]), AuthModule],
  controllers: [LeadsController, AdminLeadsController],
  providers: [
    { provide: LeadRepository, useClass: TypeOrmLeadRepository },
    JoinVipListUseCase,
    ListLeadsUseCase,
    GetLeadStatsUseCase,
    ExportLeadsUseCase,
  ],
})
export class LeadsModule {}
