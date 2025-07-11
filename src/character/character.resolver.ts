import { Resolver, Query, Args } from '@nestjs/graphql';
import { CharacterType } from './dto/character.type';
import { CharacterFilterInput } from './dto/filters.input';
import { CharacterService } from './character.service';

@Resolver(() => CharacterType)
export class CharacterResolver {
  constructor(private readonly characterService: CharacterService) {}

  @Query(() => [CharacterType])
  async characters(
    @Args('filter', { nullable: true }) filter?: CharacterFilterInput,
  ): Promise<CharacterFilterInput[]> {
    return this.characterService.findAll(filter);
  }
}
