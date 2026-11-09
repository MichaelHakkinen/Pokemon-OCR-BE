import {
  ValidationPipe,
  ValidationError,
  UnprocessableEntityException,
} from '@nestjs/common';

export class CustomValidationPipe extends ValidationPipe {
  constructor() {
    super({
      transform: true, // Enable transformation
      whitelist: true, // Automatically remove non-whitelisted properties
      forbidNonWhitelisted: true, // Throw an error for extra properties
      exceptionFactory: (validationErrors: ValidationError[]) => {
        const errors = this.flattenValidationErrors(validationErrors);
        return new UnprocessableEntityException({
          statusCode: 422,
          message: 'Validation failed',
          errors,
        });
      },
    });
  }

  protected flattenValidationErrors(
    validationErrors: ValidationError[],
  ): string[] {
    const errors: string[] = [];
    validationErrors.forEach((error) => {
      if (error.constraints) {
        // Concatenate all constraint messages into the `errors` array
        errors.push(...Object.values(error.constraints));
      }
    });
    return errors;
  }
}
