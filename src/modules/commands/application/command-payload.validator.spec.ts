import { describe, it, expect } from 'vitest';
import { CommandPayloadValidator } from './command-payload.validator.js';
import { CommandType } from '../domain/command.entity.js';
import { AppError } from '../../../shared/errors/app-error.js';

describe('CommandPayloadValidator', () => {
  describe('RING payload', () => {
    it('uses default 30 seconds when empty payload provided', () => {
      const res = CommandPayloadValidator.validate(CommandType.RING, {});
      expect(res).toEqual({ durationSeconds: 30 });
    });

    it('accepts valid duration between 5 and 60', () => {
      const res = CommandPayloadValidator.validate(CommandType.RING, { durationSeconds: 45 });
      expect(res).toEqual({ durationSeconds: 45 });
    });

    it('rejects duration < 5 or > 60', () => {
      expect(() =>
        CommandPayloadValidator.validate(CommandType.RING, { durationSeconds: 4 }),
      ).toThrow(AppError);

      expect(() =>
        CommandPayloadValidator.validate(CommandType.RING, { durationSeconds: 61 }),
      ).toThrow(AppError);
    });

    it('rejects non-integer duration', () => {
      expect(() =>
        CommandPayloadValidator.validate(CommandType.RING, { durationSeconds: '30' }),
      ).toThrow(AppError);
    });
  });

  describe('VIBRATE payload', () => {
    it('uses default 5 seconds when empty payload provided', () => {
      const res = CommandPayloadValidator.validate(CommandType.VIBRATE, {});
      expect(res).toEqual({ durationSeconds: 5 });
    });

    it('accepts valid duration between 1 and 30', () => {
      const res1 = CommandPayloadValidator.validate(CommandType.VIBRATE, { durationSeconds: 1 });
      expect(res1).toEqual({ durationSeconds: 1 });

      const res30 = CommandPayloadValidator.validate(CommandType.VIBRATE, { durationSeconds: 30 });
      expect(res30).toEqual({ durationSeconds: 30 });
    });

    it('rejects duration < 1 or > 30', () => {
      expect(() =>
        CommandPayloadValidator.validate(CommandType.VIBRATE, { durationSeconds: 0 }),
      ).toThrow(AppError);

      expect(() =>
        CommandPayloadValidator.validate(CommandType.VIBRATE, { durationSeconds: 31 }),
      ).toThrow(AppError);
    });

    it('rejects non-integer duration', () => {
      expect(() =>
        CommandPayloadValidator.validate(CommandType.VIBRATE, { durationSeconds: 5.5 }),
      ).toThrow(AppError);
    });
  });

  describe('MESSAGE payload', () => {
    it('accepts valid text and trims it', () => {
      const res = CommandPayloadValidator.validate(CommandType.MESSAGE, {
        text: '  Please return my phone  ',
      });
      expect(res).toEqual({ text: 'Please return my phone' });
    });

    it('accepts boundary 1 char and 200 chars', () => {
      const res1 = CommandPayloadValidator.validate(CommandType.MESSAGE, { text: 'A' });
      expect(res1).toEqual({ text: 'A' });

      const str200 = 'a'.repeat(200);
      const res200 = CommandPayloadValidator.validate(CommandType.MESSAGE, { text: str200 });
      expect(res200).toEqual({ text: str200 });
    });

    it('rejects 201 chars and empty/whitespace text', () => {
      const str201 = 'a'.repeat(201);
      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, { text: str201 }),
      ).toThrow(AppError);

      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, { text: '   ' }),
      ).toThrow(AppError);

      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, {}),
      ).toThrow(AppError);
    });

    it('accepts valid contactPhone with digits and optional leading +', () => {
      const res = CommandPayloadValidator.validate(CommandType.MESSAGE, {
        text: 'Found phone',
        contactPhone: '+1234567890',
      });
      expect(res).toEqual({
        text: 'Found phone',
        contactPhone: '+1234567890',
      });

      const res2 = CommandPayloadValidator.validate(CommandType.MESSAGE, {
        text: 'Found phone',
        contactPhone: '5551234',
      });
      expect(res2).toEqual({
        text: 'Found phone',
        contactPhone: '5551234',
      });
    });

    it('rejects invalid contactPhone formats and lengths', () => {
      // Letters or special chars
      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, {
          text: 'Found phone',
          contactPhone: 'phone-number',
        }),
      ).toThrow(AppError);

      // + in the middle
      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, {
          text: 'Found phone',
          contactPhone: '123+456',
        }),
      ).toThrow(AppError);

      // Too short (< 5)
      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, {
          text: 'Found phone',
          contactPhone: '1234',
        }),
      ).toThrow(AppError);

      // Too long (> 20)
      expect(() =>
        CommandPayloadValidator.validate(CommandType.MESSAGE, {
          text: 'Found phone',
          contactPhone: '123456789012345678901',
        }),
      ).toThrow(AppError);
    });
  });

  describe('LOCK payload', () => {
    it('accepts undefined, null, or empty object payload', () => {
      expect(CommandPayloadValidator.validate(CommandType.LOCK, undefined)).toBeNull();
      expect(CommandPayloadValidator.validate(CommandType.LOCK, null)).toBeNull();
      expect(CommandPayloadValidator.validate(CommandType.LOCK, {})).toBeNull();
    });

    it('rejects any non-empty payload with 400 VALIDATION_ERROR', () => {
      expect(() =>
        CommandPayloadValidator.validate(CommandType.LOCK, { pin: '1234' }),
      ).toThrow(AppError);

      expect(() =>
        CommandPayloadValidator.validate(CommandType.LOCK, { anyProp: true }),
      ).toThrow(AppError);
    });
  });
});
