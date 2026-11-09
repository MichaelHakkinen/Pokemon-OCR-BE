/* Example usage:
 * import { ErrorMessageHelper } from 'src/common/helpers/error-message.helper';
 *
 *
 * for English language
 * throw new BadRequestException(ErrorMessageHelper.getMessage('INVALID_CREDENTIALS', 'en'));
 *
 * or for Indonesian
 * throw new BadRequestException(ErrorMessageHelper.getMessage('INVALID_CREDENTIALS', 'id'));
 *
 * or to get both languages
 * const errorMessage = ErrorMessageHelper.getMultiLanguageMessage('INVALID_CREDENTIALS');
 *
 */

import { ERROR_MESSAGES, ErrorMessage } from '../constants/error-messages';

export type Language = 'en' | 'id';

export class ErrorMessageHelper {
  static getMessage(
    errorKey: keyof typeof ERROR_MESSAGES,
    lang: Language = 'en',
  ): string {
    const message = ERROR_MESSAGES[errorKey];
    if (!message) {
      return ERROR_MESSAGES.INTERNAL_SERVER_ERROR[lang];
    }
    return message[lang];
  }

  static getMultiLanguageMessage(
    errorKey: keyof typeof ERROR_MESSAGES,
  ): ErrorMessage {
    const message = ERROR_MESSAGES[errorKey];
    if (!message) {
      return ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    }
    return message;
  }

  static getMultiLanguageMessageWithReplace(
    errorKey: keyof typeof ERROR_MESSAGES,
    replacements: Record<string, string>,
  ): ErrorMessage {
    const message = ERROR_MESSAGES[errorKey];
    if (!message) {
      return ERROR_MESSAGES.INTERNAL_SERVER_ERROR;
    }

    const replacedMessage: ErrorMessage = {
      en: message.en,
      id: message.id,
    };

    // Replace placeholders in both languages
    Object.keys(replacements).forEach((key) => {
      const placeholder = `{${key}}`;
      replacedMessage.en = replacedMessage.en.replace(
        new RegExp(placeholder, 'g'),
        replacements[key],
      );
      replacedMessage.id = replacedMessage.id.replace(
        new RegExp(placeholder, 'g'),
        replacements[key],
      );
    });

    return replacedMessage;
  }
}
