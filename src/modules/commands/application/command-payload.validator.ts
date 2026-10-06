import { AppError } from '../../../shared/errors/app-error.js';
import { CommandType } from '../domain/command.entity.js';

export interface ValidatedRingPayload {
  durationSeconds: number;
}

export interface ValidatedVibratePayload {
  durationSeconds: number;
}

export interface ValidatedMessagePayload {
  text: string;
  contactPhone?: string;
}

export type ValidatedCommandPayload =
  | ValidatedRingPayload
  | ValidatedVibratePayload
  | ValidatedMessagePayload
  | null;

export class CommandPayloadValidator {
  static validate(type: CommandType, payload: any): ValidatedCommandPayload {
    if (type === CommandType.LOCK) {
      return this.validateLock(payload);
    }

    const raw = payload ?? {};

    switch (type) {
      case CommandType.RING:
        return this.validateRing(raw);
      case CommandType.VIBRATE:
        return this.validateVibrate(raw);
      case CommandType.MESSAGE:
        return this.validateMessage(raw);
      default:
        throw new AppError(
          'VALIDATION_ERROR',
          'Validation failed',
          400,
          [`Invalid command type: ${type}`],
        );
    }
  }

  private static validateLock(payload: any): null {
    if (payload !== undefined && payload !== null && Object.keys(payload).length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, [
        'LOCK command does not accept a payload',
      ]);
    }
    return null;
  }

  private static validateRing(raw: any): ValidatedRingPayload {
    const errors: string[] = [];
    let durationSeconds = 30;

    if (raw.durationSeconds !== undefined && raw.durationSeconds !== null) {
      if (
        typeof raw.durationSeconds !== 'number' ||
        !Number.isInteger(raw.durationSeconds)
      ) {
        errors.push('durationSeconds must be an integer');
      } else if (raw.durationSeconds < 5 || raw.durationSeconds > 60) {
        errors.push('durationSeconds must be between 5 and 60');
      } else {
        durationSeconds = raw.durationSeconds;
      }
    }

    if (errors.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, errors);
    }

    return { durationSeconds };
  }

  private static validateVibrate(raw: any): ValidatedVibratePayload {
    const errors: string[] = [];
    let durationSeconds = 5;

    if (raw.durationSeconds !== undefined && raw.durationSeconds !== null) {
      if (
        typeof raw.durationSeconds !== 'number' ||
        !Number.isInteger(raw.durationSeconds)
      ) {
        errors.push('durationSeconds must be an integer');
      } else if (raw.durationSeconds < 1 || raw.durationSeconds > 30) {
        errors.push('durationSeconds must be between 1 and 30');
      } else {
        durationSeconds = raw.durationSeconds;
      }
    }

    if (errors.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, errors);
    }

    return { durationSeconds };
  }

  private static validateMessage(raw: any): ValidatedMessagePayload {
    const errors: string[] = [];

    if (raw.text === undefined || raw.text === null) {
      errors.push('text is required');
    } else if (typeof raw.text !== 'string') {
      errors.push('text must be a string');
    } else {
      const trimmed = raw.text.trim();
      if (trimmed.length < 1 || trimmed.length > 200) {
        errors.push('text must be between 1 and 200 characters');
      }
    }

    let contactPhone: string | undefined = undefined;
    if (raw.contactPhone !== undefined && raw.contactPhone !== null) {
      if (typeof raw.contactPhone !== 'string') {
        errors.push('contactPhone must be a string');
      } else {
        const phone = raw.contactPhone.trim();
        const phoneRegex = /^\+?[0-9]+$/;
        if (phone.length < 5 || phone.length > 20 || !phoneRegex.test(phone)) {
          errors.push(
            'contactPhone must be between 5 and 20 characters and contain only digits and optional leading "+"',
          );
        } else {
          contactPhone = phone;
        }
      }
    }

    if (errors.length > 0) {
      throw new AppError('VALIDATION_ERROR', 'Validation failed', 400, errors);
    }

    return {
      text: (raw.text as string).trim(),
      ...(contactPhone ? { contactPhone } : {}),
    };
  }
}
