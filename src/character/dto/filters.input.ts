import { InputType, Field } from '@nestjs/graphql';

@InputType()
export class CharacterFilterInput {
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
}
