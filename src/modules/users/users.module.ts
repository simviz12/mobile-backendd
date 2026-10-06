import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository.js';
import { GetCurrentUserUseCase } from './application/get-current-user.usecase.js';
import { UserRepository } from './domain/user.repository.js';

@Module({
  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
    {
      provide: GetCurrentUserUseCase,
      useFactory: (repo: UserRepository) => new GetCurrentUserUseCase(repo),
      inject: [USER_REPOSITORY],
    },
  ],
  exports: [USER_REPOSITORY, GetCurrentUserUseCase],
})
export class UsersModule {}
