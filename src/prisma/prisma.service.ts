import { 
  Injectable, 
  OnModuleInit, 
  OnModuleDestroy, 
  Logger 
} from '@nestjs/common';
import { PrismaClient } from 'generated/prisma';
@Injectable()
export class PrismaService 
  extends PrismaClient 
  implements OnModuleInit, OnModuleDestroy 
{
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Prisma database connection established successfully.');
    } catch (error) {
      this.logger.error('Failed to connect to Prisma database.', error.stack);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Prisma database connection closed.');
  }
}