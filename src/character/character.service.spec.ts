import { Test, TestingModule } from '@nestjs/testing';
import { CharacterService } from './character.service';
import { getModelToken } from '@nestjs/sequelize';
import { Character } from './character.model';
import { RedisService } from '../redis/redis.service';
import { CharacterFilterInput } from './dto/filters.input';
import { CharacterType } from './dto/character.type';
import { Op } from 'sequelize';

// Mock GraphQLClient
jest.mock('graphql-request', () => ({
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn().mockResolvedValue({
      characters: {
        results: [
          {
            id: 1,
            name: 'Rick Sanchez',
            status: 'Alive',
            species: 'Human',
            gender: 'Male',
            image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
            origin: { name: 'Earth' },
          },
          {
            id: 2,
            name: 'Morty Smith',
            status: 'Alive',
            species: 'Human',
            gender: 'Male',
            image: 'https://rickandmortyapi.com/api/character/avatar/2.jpeg',
            origin: { name: 'Earth' },
          },
        ],
      },
    }),
  })),
  gql: jest.fn(),
}));

describe('CharacterService', () => {
  let service: CharacterService;

  const mockCharacterModel = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
  };

  const mockCharacters: CharacterType[] = [
    {
      id: 1,
      name: 'Rick Sanchez',
      status: 'Alive',
      species: 'Human',
      gender: 'Male',
      origin: 'Earth',
      image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
    },
    {
      id: 2,
      name: 'Morty Smith',
      status: 'Alive',
      species: 'Human',
      gender: 'Male',
      origin: 'Earth',
      image: 'https://rickandmortyapi.com/api/character/avatar/2.jpeg',
    },
    {
      id: 3,
      name: 'Summer Smith',
      status: 'Dead',
      species: 'Human',
      gender: 'Female',
      origin: 'Earth',
      image: 'https://rickandmortyapi.com/api/character/avatar/3.jpeg',
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterService,
        {
          provide: getModelToken(Character),
          useValue: mockCharacterModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<CharacterService>(CharacterService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFilterKey', () => {
    it('should create correct cache key for empty filter', () => {
      const cacheKey = service['createFilterKey'](undefined);
      expect(cacheKey).toBe('all');
    });

    it('should create correct cache key for single filter', () => {
      const filter: CharacterFilterInput = { status: 'Alive' };
      const cacheKey = service['createFilterKey'](filter);
      expect(cacheKey).toBe('status:Alive');
    });

    it('should create correct cache key for multiple filters', () => {
      const filter: CharacterFilterInput = {
        status: 'Alive',
        species: 'Human',
        gender: 'Male',
      };
      const cacheKey = service['createFilterKey'](filter);
      expect(cacheKey).toBe('status:Alive|species:Human|gender:Male');
    });
  });

  describe('syncCharactersFromAPI', () => {
    it('should create new characters when they do not exist in database', async () => {
      // Mock that no characters exist in database
      mockCharacterModel.findOne.mockResolvedValue(null);
      mockCharacterModel.create.mockResolvedValue({} as Character);

      await service.syncCharactersFromAPI();

      // Verify characters were created
      expect(mockCharacterModel.findOne).toHaveBeenCalledTimes(2);
      expect(mockCharacterModel.create).toHaveBeenCalledTimes(2);

      // Verify first character creation
      expect(mockCharacterModel.create).toHaveBeenCalledWith({
        id: 1,
        name: 'Rick Sanchez',
        status: 'Alive',
        species: 'Human',
        gender: 'Male',
        image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
        origin: 'Earth',
      });
    });

    it('should update existing characters when data has changed', async () => {
      // Mock existing character with different data
      const existingCharacter = {
        id: 1,
        name: 'Rick Sanchez',
        status: 'Dead', // Different from API
        species: 'Human',
        gender: 'Male',
        image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
        origin: 'Mars', // Different from API
      };

      mockCharacterModel.findOne
        .mockResolvedValueOnce(existingCharacter as Character) // First character exists with different data
        .mockResolvedValueOnce(null); // Second character doesn't exist
      mockCharacterModel.update.mockResolvedValue([1]);
      mockCharacterModel.create.mockResolvedValue({} as Character);

      await service.syncCharactersFromAPI();

      // Verify character was updated
      expect(mockCharacterModel.update).toHaveBeenCalledWith(
        {
          id: 1,
          name: 'Rick Sanchez',
          status: 'Alive',
          species: 'Human',
          gender: 'Male',
          image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
          origin: 'Earth',
        },
        {
          where: { id: 1 },
        },
      );
    });

    it('should not update characters when data is the same', async () => {
      // Mock existing character with same data
      const existingCharacter = {
        id: 1,
        name: 'Rick Sanchez',
        status: 'Alive',
        species: 'Human',
        gender: 'Male',
        image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
        origin: 'Earth',
      };

      mockCharacterModel.findOne
        .mockResolvedValueOnce(existingCharacter as Character) // First character exists with same data
        .mockResolvedValueOnce(null); // Second character doesn't exist
      mockCharacterModel.create.mockResolvedValue({} as Character);

      await service.syncCharactersFromAPI();

      // Verify character was NOT updated
      expect(mockCharacterModel.update).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return cached data when available', async () => {
      const filter: CharacterFilterInput = { status: 'Alive' };
      const cachedData = [mockCharacters[0], mockCharacters[1]];

      mockRedisService.get.mockResolvedValue(cachedData);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Alive',
      );
      expect(mockCharacterModel.findAll).not.toHaveBeenCalled();
      expect(result).toEqual(cachedData);
    });

    it('should return all characters when no filter is provided and no cache', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue(mockCharacters);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll();

      expect(mockRedisService.get).toHaveBeenCalledWith('characters:all');
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({ where: {} });
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'characters:all',
        mockCharacters,
        300,
      );
      expect(result).toEqual(mockCharacters);
    });

    it('should filter by name and return only matching characters', async () => {
      const filter: CharacterFilterInput = { name: 'Rick' };
      const filteredCharacters = [mockCharacters[0]];

      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue(filteredCharacters);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith('characters:name:Rick');
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          name: { [Op.iLike]: '%Rick%' },
        },
      });
      expect(result).toEqual(filteredCharacters);
    });

    it('should filter by status and return only matching characters', async () => {
      const filter: CharacterFilterInput = { status: 'Dead' };
      const filteredCharacters = [mockCharacters[2]];

      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue(filteredCharacters);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Dead',
      );
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          status: 'Dead',
        },
      });
      expect(result).toEqual(filteredCharacters);
    });

    it('should handle multiple filters correctly', async () => {
      const filter: CharacterFilterInput = {
        status: 'Alive',
        species: 'Human',
        gender: 'Male',
      };
      const filteredCharacters = [mockCharacters[0], mockCharacters[1]];

      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue(filteredCharacters);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Alive|species:Human|gender:Male',
      );
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          status: 'Alive',
          species: 'Human',
          gender: 'Male',
        },
      });
      expect(result).toEqual(filteredCharacters);
    });

    it('should return empty array when no characters match filter', async () => {
      const filter: CharacterFilterInput = { status: 'Unknown' };

      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue([]);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Unknown',
      );
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          status: 'Unknown',
        },
      });
      expect(result).toEqual([]);
    });

    it('should handle cache errors gracefully and fallback to database', async () => {
      const filter: CharacterFilterInput = { status: 'Alive' };
      const filteredCharacters = [mockCharacters[0], mockCharacters[1]];

      mockRedisService.get.mockRejectedValue(
        new Error('Redis connection failed'),
      );
      mockCharacterModel.findAll.mockResolvedValue(filteredCharacters);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Alive',
      );
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          status: 'Alive',
        },
      });
      expect(result).toEqual(filteredCharacters);
    });

    it('should handle cache set errors gracefully', async () => {
      const filter: CharacterFilterInput = { status: 'Alive' };
      const filteredCharacters = [mockCharacters[0], mockCharacters[1]];

      mockRedisService.get.mockResolvedValue(null);
      mockCharacterModel.findAll.mockResolvedValue(filteredCharacters);
      mockRedisService.set.mockRejectedValue(new Error('Redis set failed'));

      const result = await service.findAll(filter);

      expect(mockRedisService.get).toHaveBeenCalledWith(
        'characters:status:Alive',
      );
      expect(mockCharacterModel.findAll).toHaveBeenCalledWith({
        where: {
          status: 'Alive',
        },
      });
      expect(result).toEqual(filteredCharacters);
    });
  });
});
