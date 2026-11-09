import { SetMetadata } from '@nestjs/common';
import { SUCCESS_MESSAGES } from 'src/common/constants/success-messages';

export const RESPONSE_MESSAGE_KEY = 'response_message';

// Names the success message ResponseInterceptor puts in the envelope.
// Routes without it get DEFAULT_MESSAGE.
export const ResponseMessage = (key: keyof typeof SUCCESS_MESSAGES) =>
  SetMetadata(RESPONSE_MESSAGE_KEY, key);

export const RAW_RESPONSE_KEY = 'raw_response';

// Opts a route out of the envelope, e.g. health checks whose body format is
// fixed by the tooling that reads it.
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
