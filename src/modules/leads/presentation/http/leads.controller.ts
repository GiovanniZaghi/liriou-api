import { Body, Controller, Get, HttpCode, Post, Query, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { presentPaginated } from '../../../../shared/presentation/http/paginated.presenter'
import { JwtAuthGuard } from '../../../auth/presentation/http/jwt-auth.guard'
import {
  ExportLeadsUseCase,
  GetLeadStatsUseCase,
  JoinVipListUseCase,
  ListLeadsUseCase,
} from '../../application/leads.use-cases'
import { PAIN_OPTIONS } from '../../domain/lead'
import { ExportLeadsQueryDto, JoinVipListDto, ListLeadsQueryDto } from './dto/lead.dto'
import { leadsToCsv, presentLead } from './lead.presenter'

@ApiTags('Lista VIP')
@Controller('leads')
export class LeadsController {
  constructor(private readonly joinVipList: JoinVipListUseCase) {}

  /** Cadastro na lista VIP. E-mail repetido também responde 204 (não revela quem já está na lista). */
  @Post()
  @HttpCode(204)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async join(@Body() dto: JoinVipListDto) {
    await this.joinVipList.execute(dto)
  }

  @Get('pain-options')
  painOptions() {
    return { data: PAIN_OPTIONS }
  }
}

@ApiTags('Admin · Lista VIP')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(
    private readonly listLeads: ListLeadsUseCase,
    private readonly getStats: GetLeadStatsUseCase,
    private readonly exportLeads: ExportLeadsUseCase,
  ) {}

  @Get()
  async list(@Query() { page, pageSize, ...filters }: ListLeadsQueryDto) {
    const result = await this.listLeads.execute({ filters, page: { page, pageSize } })
    return presentPaginated(result, presentLead)
  }

  @Get('stats')
  stats() {
    return this.getStats.execute()
  }

  @Get('export')
  async export(@Query() filters: ExportLeadsQueryDto, @Res() res: Response) {
    const csv = leadsToCsv(await this.exportLeads.execute(filters))
    const stamp = new Date().toISOString().slice(0, 10)
    res
      .set({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="liriou-lista-vip-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      })
      .send(csv)
  }
}
