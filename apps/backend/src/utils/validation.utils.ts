import { BadRequestException } from '@nestjs/common';

/**
 * Ensures an ID is a positive integer.
 *
 * @param id - The ID to check.
 * @param entityName - The entity the ID belongs to, used in the error message.
 * @throws {BadRequestException} If the ID is not a positive integer.
 */
export function validateId(id: number, entityName: string): void {
  if (!Number.isInteger(id) || id < 1) {
    throw new BadRequestException(`Invalid ${entityName} ID`);
  }
}
