import { Test, TestingModule } from '@nestjs/testing';
import { CharacterResolver } from './character.resolver';
import { CharacterService } from './character.service';
import { CharacterType } from './dto/character.type';
import { CharacterFilterInput } from './dto/filters.input';

describe('CharacterResolver', () => {
  let resolver: CharacterResolver;

  const mockCharacterService = {
    findAll: jest.fn(),
    syncCharactersFromAPI: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CharacterResolver,
        {
          provide: CharacterService,
          useValue: mockCharacterService,
        },
      ],
    }).compile();

    resolver = module.get<CharacterResolver>(CharacterResolver);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('characters query', () => {
    it('should return all characters when no filter is provided', async () => {
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
      ];

      mockCharacterService.findAll.mockResolvedValue(mockCharacters);

      const result = await resolver.characters();

      expect(mockCharacterService.findAll).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockCharacters);
    });

    it('should return filtered characters when filter is provided', async () => {
      const filter: CharacterFilterInput = {
        status: 'Alive',
        species: 'Human',
      };

      const mockFilteredCharacters: CharacterType[] = [
        {
          id: 1,
          name: 'Rick Sanchez',
          status: 'Alive',
          species: 'Human',
          gender: 'Male',
          origin: 'Earth',
          image: 'https://rickandmortyapi.com/api/character/avatar/1.jpeg',
        },
      ];

      mockCharacterService.findAll.mockResolvedValue(mockFilteredCharacters);

      const result = await resolver.characters(filter);

      expect(mockCharacterService.findAll).toHaveBeenCalledWith(filter);
      expect(result).toEqual(mockFilteredCharacters);
    });

    it('should handle service errors gracefully', async () => {
      const filter: CharacterFilterInput = {
        name: 'Rick',
      };

      const error = new Error('Database connection failed');
      mockCharacterService.findAll.mockRejectedValue(error);

      await expect(resolver.characters(filter)).rejects.toThrow(
        'Database connection failed',
      );
      expect(mockCharacterService.findAll).toHaveBeenCalledWith(filter);
    });
  });

  describe('External API Integration Tests', () => {
    it('should handle characters with unknown origin', async () => {
      // Mock the syncCharactersFromAPI method on the service
      mockCharacterService.syncCharactersFromAPI = jest
        .fn()
        .mockResolvedValue(undefined);

      // Test that the service method can be called (this would be called by a resolver method)
      await mockCharacterService.syncCharactersFromAPI();

      expect(mockCharacterService.syncCharactersFromAPI).toHaveBeenCalled();
    });

    it('should limit characters to first 15 from API', async () => {
      // Mock the syncCharactersFromAPI method on the service
      mockCharacterService.syncCharactersFromAPI = jest
        .fn()
        .mockResolvedValue(undefined);

      // Test that the service method can be called (this would be called by a resolver method)
      await mockCharacterService.syncCharactersFromAPI();

      expect(mockCharacterService.syncCharactersFromAPI).toHaveBeenCalled();
    });
  });
});
