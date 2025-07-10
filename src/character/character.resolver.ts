import { Resolver, Query } from '@nestjs/graphql';

@Resolver()
export class CharacterResolver {
  @Query(() => String)
  hello(): string {
    return 'Hello World!';
  }
}
