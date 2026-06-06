import { Module, Global } from '@nestjs/common';
import { NumberingService } from './utils/numbering.service';

@Global()
@Module({
  providers: [NumberingService],
  exports: [NumberingService],
})
export class CoreModule {}
