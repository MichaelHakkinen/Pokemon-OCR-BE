import 'reflect-metadata';
import {
  PipeTransform,
  ArgumentMetadata,
  UnprocessableEntityException,
} from '@nestjs/common';
import { getMetadataStorage, validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { VALIDATION_MESSAGES } from '../common/constants/validation-messages';
import { FIELD_NAMES } from '../common/constants/field-names';

interface TranslatedFieldError {
  en: string;
  id: string;
}

interface ValidationErrors {
  [key: string]: TranslatedFieldError;
}

export class TranslatedValidationPipe implements PipeTransform<any> {
  constructor(
    private readonly options: {
      whitelist: boolean;
      transform: boolean;
      forbidNonWhitelisted: boolean;
    } = {
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    },
  ) {}

  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!metatype || !this.toValidate(metatype)) {
      return value;
    }

    const object = plainToClass(metatype, value);
    const errors = await validate(object, {
      validationError: { target: true },
      whitelist: this.options.whitelist,
      forbidNonWhitelisted: this.options.forbidNonWhitelisted,
      stopAtFirstError: false,
      validationArguments: true,
      enableDebugMessages: true, // This will give us detailed validation info
    });

    if (errors.length > 0) {
      const translatedErrors = this.formatErrors(errors);
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Validation failed',
        errors: translatedErrors,
      });
    }

    return this.options.transform ? object : value;
  }

  private formatErrors(errors: ValidationError[]): ValidationErrors {
    const translatedErrors: ValidationErrors = {};

    errors.forEach((error) => {
      if (error.constraints) {
        // Get all constraint messages for this field
        const messages = Object.entries(error.constraints).map(
          ([key, decoratorMessage]) => {
            if (VALIDATION_MESSAGES[decoratorMessage]) {
              const translation = VALIDATION_MESSAGES[decoratorMessage];
              return {
                en: this.replaceMessagePlaceholders(
                  translation.en,
                  error,
                  key,
                  'en',
                ),
                id: this.replaceMessagePlaceholders(
                  translation.id,
                  error,
                  key,
                  'id',
                ),
              };
            } else {
              // Try with the constraint key
              const messageKey = key.toUpperCase();
              const translation = VALIDATION_MESSAGES[messageKey];
              if (translation) {
                return {
                  en: this.replaceMessagePlaceholders(
                    translation.en,
                    error,
                    key,
                    'en',
                  ),
                  id: this.replaceMessagePlaceholders(
                    translation.id,
                    error,
                    key,
                    'id',
                  ),
                };
              }
              // Fallback to original message
              return {
                en: decoratorMessage,
                id: decoratorMessage,
              };
            }
          },
        );

        // Use the first message for this field
        if (messages.length > 0) {
          translatedErrors[error.property] = messages[0];
        }
      }

      // Handle nested errors
      if (error.children && error.children.length > 0) {
        const childErrors = this.formatErrors(error.children);
        Object.assign(translatedErrors, childErrors);
      }
    });

    return translatedErrors;
  }

  private replaceMessagePlaceholders(
    message: string,
    error: ValidationError,
    constraintKey: string,
    language: 'en' | 'id',
  ): string {
    // Replace property name with translated field name
    const fieldTranslation = FIELD_NAMES[error.property];
    const propertyName = fieldTranslation
      ? fieldTranslation[language]
      : error.property;

    // $constraint1, $constraint2, ... come from the decorator's own arguments
    // (e.g. @MaxLength(255) -> 255, @IsIn(['a','b']) -> "a, b"), so every
    // validator gets correct numbers without per-field special cases.
    const values = this.constraintValues(error, constraintKey);
    return message
      .replace(/\$property/g, propertyName)
      .replace(/\$constraint(\d+)/g, (placeholder, n) => {
        const value = values[Number(n) - 1];
        return value === undefined ? placeholder : this.formatConstraint(value);
      });
  }

  // Arguments of the decorator that produced `constraintKey` on this property.
  private constraintValues(
    error: ValidationError,
    constraintKey: string,
  ): unknown[] {
    if (!error.target) return [];
    const metadata = getMetadataStorage()
      .getTargetValidationMetadatas(error.target.constructor, '', true, false)
      .find(
        (m) =>
          m.propertyName === error.property &&
          (m.name === constraintKey || m.type === constraintKey),
      );
    return metadata?.constraints ?? [];
  }

  private formatConstraint(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    if (value && typeof value === 'object') {
      return Object.values(value).join(', '); // enums
    }
    return String(value);
  }

  private toValidate(metatype: abstract new (...args: any[]) => any): boolean {
    const types: (abstract new (...args: any[]) => any)[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return !types.includes(metatype);
  }
}
