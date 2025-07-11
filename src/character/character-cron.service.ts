import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CharacterService } from './character.service';

@Injectable()
export class CharacterCronService {
  private readonly logger = new Logger(CharacterCronService.name);

  constructor(private readonly characterService: CharacterService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async handleCharacterSync() {
    this.logger.log('⏰ Running 10s character sync job...');
    await this.characterService.syncCharactersFromAPI();
    this.logger.log('✅ Character sync complete');
  }
}
