import { Injectable } from '@nestjs/common';
import { CharacterType } from './dto/character.type';
import { CharacterFilterInput } from './dto/filters.input';

@Injectable()
export class CharacterService {
  async findAll(filter?: CharacterFilterInput): Promise<CharacterType[]> {
    // TODO: Implement actual data fetching logic
    // For now, return empty array to fix the schema generation
    console.log('Filter applied:', filter);
    return await Promise.resolve([]);
  }
}
