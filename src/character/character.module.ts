import { Module } from '@nestjs/common';
import { CharacterService } from './character.service';
import { CharacterResolver } from './character.resolver';
import { SequelizeModule } from '@nestjs/sequelize';
import { Character } from './character.model';

@Module({
  imports: [SequelizeModule.forFeature([Character])],
  providers: [CharacterService, CharacterResolver],
})
export class CharacterModule {
  constructor(private readonly characterService: CharacterService) {}

  async onModuleInit() {
    await this.characterService.seedInitialCharacters();
  }
}
