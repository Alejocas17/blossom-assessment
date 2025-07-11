// src/database/database.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule, SequelizeModuleOptions } from '@nestjs/sequelize';
import { Character } from '../character/character.model';

@Module({
  imports: [
    SequelizeModule.forRootAsync({
      useFactory: (): SequelizeModuleOptions => ({
        dialect: 'postgres',
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? +process.env.DB_PORT : 5432,
        username: process.env.DB_USER,
        password: process.env.DB_PASS,
        database: process.env.DB_NAME,
        // autoLoadModels: true,
        // synchronize: true,
        models: [Character],
      }),
    }),
  ],
})
export class DatabaseModule {}
