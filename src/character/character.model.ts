import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table
export class Character extends Model<Character> {
  @Column({ primaryKey: true, autoIncrement: true, type: DataType.INTEGER })
  declare id: number;

  @Column
  name: string;

  @Column
  status: string;

  @Column
  species: string;

  @Column
  gender: string;

  @Column
  image: string;

  @Column({ type: DataType.JSONB })
  origin: { name: string; url: string };
}
