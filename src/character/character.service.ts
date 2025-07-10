import { Injectable, Logger } from '@nestjs/common';
import { CharacterType } from './dto/character.type';
import { CharacterFilterInput } from './dto/filters.input';
import { GraphQLClient, gql } from 'graphql-request';
import { Character } from './character.model';
import { InjectModel } from '@nestjs/sequelize';
import { Op, WhereOptions } from 'sequelize';

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
  ) {}

  async seedInitialCharacters(): Promise<void> {
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

    const records = characters.map((c) => ({
      id: +c.id,
      name: c.name,
      status: c.status,
      species: c.species,
      gender: c.gender,
      image: c.image,
      origin: c.origin?.name || '',
    })) as Character[];

    await this.characterModel.bulkCreate(records, {
      ignoreDuplicates: true,
    });

    this.logger.log(`Seeded ${records.length} characters`);
  }

  async findAll(filter?: CharacterFilterInput): Promise<CharacterType[]> {
    const filterQuery: WhereOptions<Character> = {};
    if (filter?.origin) {
      filterQuery.origin = filter.origin;
    }
    if (filter?.name) {
      filterQuery.name = { [Op.like]: `%${filter.name}%` } as unknown as string;
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

    return this.characterModel.findAll({ where: filterQuery });
  }
}
