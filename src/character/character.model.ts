import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table
export class Character extends Model<Character> {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare id: number;

  @Column
  declare name: string;

  @Column
  declare status: string;

  @Column
  declare species: string;

  @Column
  declare gender: string;

  @Column
  declare image: string;

  @Column({ type: DataType.JSONB })
  declare origin: { name: string; url: string };
}
