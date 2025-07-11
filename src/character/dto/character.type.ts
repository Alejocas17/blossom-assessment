import { ObjectType, Field, Int } from '@nestjs/graphql';

@ObjectType()
export class CharacterType {
  @Field(() => Int)
  id: number;

  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  species?: string;

  @Field({ nullable: true })
  gender?: string;

  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  origin?: string;

  @Field()
  image: string;
}
