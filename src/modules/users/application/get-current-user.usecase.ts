import { UserRepository } from '../domain/user.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';

export interface UserProfileDto {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}

export class GetCurrentUserUseCase {
  constructor(private readonly userRepository: UserRepository) {}

  async execute(userId: string): Promise<UserProfileDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('USER_NOT_FOUND', 'User does not exist', 404);
    }

    return user.toPublic();
  }
}
