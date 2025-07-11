import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CharacterService } from './character.service';

@Injectable()
export class CharacterCronService {
  private readonly logger = new Logger(CharacterCronService.name);

  constructor(private readonly characterService: CharacterService) {}

  @Cron(CronExpression.EVERY_12_HOURS)
  async handleCharacterSync() {
    this.logger.log('⏰ Running 12h character sync job...');
    await this.characterService.syncCharactersFromAPI();
    this.logger.log('✅ Character sync complete');
  }
}
