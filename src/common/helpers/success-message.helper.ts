/*
 * Helper to access multi-language success messages
 * Usage examples:
 * import { SuccessMessageHelper } from 'src/common/helpers/success-message.helper';
 * In controllers prefer @ResponseMessage('DATA_CREATED_SUCCESS'), which uses this helper.
 * const multi = SuccessMessageHelper.getMultiLanguageMessage('DATA_CREATED_SUCCESS')
 */

import {
  SUCCESS_MESSAGES,
  SuccessMessage,
} from '../constants/success-messages';

export type Language = 'en' | 'id';

export class SuccessMessageHelper {
  static getMessage(
    key: keyof typeof SUCCESS_MESSAGES,
    lang: Language = 'en',
  ): string {
    const message = SUCCESS_MESSAGES[key];
    if (!message) {
      return SUCCESS_MESSAGES.DATA_RETRIEVED_SUCCESS[lang];
    }
    return message[lang] ?? SUCCESS_MESSAGES.DATA_RETRIEVED_SUCCESS[lang];
  }

  static getMultiLanguageMessage(
    key: keyof typeof SUCCESS_MESSAGES,
  ): SuccessMessage {
    const message = SUCCESS_MESSAGES[key];
    if (!message) {
      return SUCCESS_MESSAGES.DATA_RETRIEVED_SUCCESS;
    }
    return message;
  }
}
