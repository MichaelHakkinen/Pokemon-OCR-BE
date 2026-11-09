import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export type MailRelayLogData = {
  method?: string;
  url?: string;
  recipient?: string;
  subject?: string;
  templateName?: string | null;
  requestHeaders?: string | null;
  requestBody?: string | null;
  responseStatus?: number | null;
  responseHeaders?: string | null;
  responseBody?: string | null;
  isSuccess: boolean;
  errorMessage?: string | null;
  durationMs?: number;
};

@Injectable()
export class MailRelayLogModel {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record one Marley mail relay request/response pair
   */
  createLog = async (data: MailRelayLogData) => {
    return await this.prisma.mailRelayLog.create({ data });
  };
}
