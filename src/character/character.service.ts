import { Injectable, Logger } from '@nestjs/common';
import { CharacterType } from './dto/character.type';
import { CharacterFilterInput } from './dto/filters.input';
import { GraphQLClient, gql } from 'graphql-request';
import { Character } from './character.model';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';
import { Timed } from 'src/common/decorators/timed.decorator';
import { RedisService } from '../redis/redis.service';

type RAMCharacter = {
  id: number;
  name: string;
  status: string;
  species: string;
  gender: string;
  image: string;
  origin: {
    name: string;
  };
};
@Injectable()
export class CharacterService {
  private readonly logger = new Logger(CharacterService.name);
  private readonly client = new GraphQLClient(
    process.env.RAM_API_URL ? process.env.RAM_API_URL : '',
  );
  constructor(
    @InjectModel(Character)
    private characterModel: typeof Character,
    private readonly redisService: RedisService,
  ) {}

  private createFilterKey(filter?: CharacterFilterInput): string {
    const filterString: string[] = [];

    if (filter?.name) filterString.push(`name:${filter.name}`);
    if (filter?.status) filterString.push(`status:${filter.status}`);
    if (filter?.species) filterString.push(`species:${filter.species}`);
    if (filter?.gender) filterString.push(`gender:${filter.gender}`);
    if (filter?.origin) filterString.push(`origin:${filter.origin}`);

    return filterString.length > 0 ? filterString.join('|') : 'all';
  }

  @Timed()
  async syncCharactersFromAPI(): Promise<void> {
    const query = gql`
      query {
        characters(page: 1) {
          results {
            id
            name
            status
            species
            gender
            image
            origin {
              name
            }
          }
        }
      }
    `;

    const data = await this.client.request<{
      characters: { results: RAMCharacter[] };
    }>(query);
    const characters = data.characters.results.slice(0, 15);
    for (const character of characters) {
      const payload = {
        id: +character.id,
        name: character.name,
        status: character.status,
        species: character.species,
        gender: character.gender,
        image: character.image,
        origin: character.origin?.name || 'Unknown',
      };
      const existing = await this.characterModel.findOne({
        where: { id: payload.id },
      });
      if (!existing) {
        await this.characterModel.create(payload as Character);
        this.logger.log(`🆕 Created character ${character.name}`);
      } else {
        if (
          existing.name !== payload.name ||
          existing.origin !== payload.origin ||
          existing.status !== payload.status ||
          existing.species !== payload.species ||
          existing.gender !== payload.gender ||
          existing.image !== payload.image
        ) {
          await this.characterModel.update(payload, {
            where: { id: payload.id },
          });
          this.logger.log(`Updated character ${character.name}`);
        }
      }
    }
  }
  @Timed()
  async findAll(filter?: CharacterFilterInput): Promise<CharacterType[]> {
    const filterString = filter ? this.createFilterKey(filter) : 'all';
    const cacheKey = `characters:${filterString}`;
    try {
      const cached = (await this.redisService.get(cacheKey)) as CharacterType[];
      if (cached) {
        this.logger.log(`Cache Found for key: ${cacheKey}`);
        return cached;
      }
    } catch (error) {
      this.logger.error(`Cache error for key: ${cacheKey}`, error);
    }
    const filterQuery: WhereOptions<Character> = {};

    if (filter?.origin) {
      filterQuery.origin = filter.origin;
    }
    if (filter?.name) {
      filterQuery.name = { [Op.iLike]: `%${filter.name}%` };
    }
    if (filter?.status) {
      filterQuery.status = filter.status;
    }
    if (filter?.species) {
      filterQuery.species = filter.species;
    }
    if (filter?.gender) {
      filterQuery.gender = filter.gender;
    }

    const results = await this.characterModel.findAll({ where: filterQuery });

    // Store in cache for next time (5 minutes TTL)
    try {
      await this.redisService.set(cacheKey, results, 300);
      this.logger.log(
        `💾 Stored in cache: ${cacheKey} (${results.length} characters)`,
      );
    } catch (error) {
      this.logger.error(`Error storing in cache: ${cacheKey}`, error);
    }

    return results as CharacterType[];
  }
}
