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

type RAMAPIResponse = {
  characters: {
    results: RAMCharacter[];
    info: {
      pages: number;
      next: number | null;
    };
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

  private async searchCharactersFromAPI(
    page: number = 1,
    filter?: CharacterFilterInput,
  ): Promise<{ characters: RAMCharacter[]; totalPages: number }> {
    // Build filter variables for GraphQL query
    const filterVariables: any = { page };

    if (filter?.name) filterVariables.name = filter.name;
    if (filter?.status) filterVariables.status = filter.status;
    if (filter?.species) filterVariables.species = filter.species;
    if (filter?.gender) filterVariables.gender = filter.gender;

    const query = gql`
      query Characters(
        $page: Int
        $name: String
        $status: String
        $species: String
        $gender: String
      ) {
        characters(
          page: $page
          filter: {
            name: $name
            status: $status
            species: $species
            gender: $gender
          }
        ) {
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
          info {
            pages
            next
          }
        }
      }
    `;

    try {
      const data = await this.client.request<RAMAPIResponse>(
        query,
        filterVariables,
      );
      return {
        characters: data.characters.results,
        totalPages: data.characters.info.pages,
      };
    } catch (error) {
      this.logger.error(
        `Error fetching characters from API (page ${page}):`,
        error,
      );
      return { characters: [], totalPages: 0 };
    }
  }

  private async syncCharactersFromAPIWithFilter(
    filter?: CharacterFilterInput,
    maxPages: number = 5,
  ): Promise<CharacterType[]> {
    const syncedCharacters: CharacterType[] = [];
    let currentPage = 1;
    let totalPages = 1;

    while (currentPage <= Math.min(maxPages, totalPages)) {
      this.logger.log(
        `Searching API page ${currentPage} with filter: ${JSON.stringify(filter)}`,
      );

      const { characters, totalPages: apiTotalPages } =
        await this.searchCharactersFromAPI(currentPage, filter);

      if (currentPage === 1) {
        totalPages = apiTotalPages;
      }

      if (characters.length === 0) {
        break;
      }

      // Process and save characters
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

        // Check if character matches origin filter (if specified)
        if (filter?.origin && payload.origin !== filter.origin) {
          continue;
        }

        const existing = await this.characterModel.findOne({
          where: { id: payload.id },
        });

        if (!existing) {
          const created = await this.characterModel.create(
            payload as Character,
          );
          syncedCharacters.push(created as CharacterType);
          this.logger.log(`Created character ${character.name} from API`);
        } else {
          // Update if data has changed
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
            this.logger.log(`Updated character ${character.name} from API`);
          }
          syncedCharacters.push(existing as CharacterType);
        }
      }

      currentPage++;
    }

    this.logger.log(`Synced ${syncedCharacters.length} characters from API`);
    return syncedCharacters;
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

    let results = await this.characterModel.findAll({ where: filterQuery });

    // If no results found locally, search in external API
    if (results.length === 0) {
      this.logger.log(
        `No local results found for filter: ${JSON.stringify(filter)}. Searching external API...`,
      );

      try {
        const apiResults = await this.syncCharactersFromAPIWithFilter(
          filter,
          3, // Limit to 3 pages for performance
        );
        results = apiResults as Character[]; // Type assertion to fix type mismatch

        if (results.length > 0) {
          this.logger.log(
            `Found ${results.length} characters from external API`,
          );
          // Filtrar por origen si es necesario
          let filteredResults = results;
          if (filter?.origin) {
            filteredResults = results.filter(
              (result) => result.origin === filter.origin,
            );
          }

          // Obtener los IDs de los personajes a crear
          const ids = filteredResults.map((c) => c.id);
          const existing = await this.characterModel.findAll({
            where: { id: ids },
            attributes: ['id'],
            raw: true,
          });
          const existingIds = new Set(existing.map((c) => c.id));
          const toCreate = filteredResults.filter(
            (c) => !existingIds.has(c.id),
          );

          if (toCreate.length > 0) {
            await this.characterModel.bulkCreate(toCreate);
            this.logger.log(`Created ${toCreate.length} new characters in DB`);
          }
          results = filteredResults;
        }
      } catch (error) {
        this.logger.error('Error searching external API:', error);
      }
    }

    // Store in cache for next time (5 minutes TTL)
    try {
      await this.redisService.set(cacheKey, results, 300);
      this.logger.log(
        `Stored in cache: ${cacheKey} (${results.length} characters)`,
      );
    } catch (error) {
      this.logger.error(`Error storing in cache: ${cacheKey}`, error);
    }

    return results as CharacterType[];
  }
}
