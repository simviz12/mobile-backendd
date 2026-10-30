import { SendCommandUseCase } from './send-command.usecase.js';
import { Command, CommandType } from '../domain/command.entity.js';

export interface SendRingCommandInput {
  deviceId: string;
  callerUserId: string;
  durationSeconds?: number;
}

export class SendRingCommandUseCase {
  constructor(private readonly sendCommandUseCase: SendCommandUseCase) {}

  async execute(input: SendRingCommandInput): Promise<Command> {
    return this.sendCommandUseCase.execute({
      deviceId: input.deviceId,
      callerUserId: input.callerUserId,
      type: CommandType.RING,
      payload: input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {},
    });
  }
}
