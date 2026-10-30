import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  COMMAND_REPOSITORY,
  type CommandRepository,
} from '../domain/command.repository.js';

@Injectable()
export class CommandExpiryJob {
  private readonly logger = new Logger(CommandExpiryJob.name);

  constructor(
    @Inject(COMMAND_REPOSITORY)
    private readonly commandRepository: CommandRepository,
  ) {}

  @Cron('*/30 * * * * *') // Run every 30 seconds
  async handleCron() {
    const now = new Date();
    const expiredCommands =
      await this.commandRepository.findExpiredPendingOrSent(now);

    if (expiredCommands.length > 0) {
      this.logger.log(
        `Expiring ${expiredCommands.length} outdated command(s)...`,
      );
      for (const cmd of expiredCommands) {
        cmd.markExpired();
        await this.commandRepository.save(cmd);
      }
    }
  }

  async runManually(now: Date = new Date()): Promise<number> {
    const expiredCommands =
      await this.commandRepository.findExpiredPendingOrSent(now);
    for (const cmd of expiredCommands) {
      cmd.markExpired();
      await this.commandRepository.save(cmd);
    }
    return expiredCommands.length;
  }
}
