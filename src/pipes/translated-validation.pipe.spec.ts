import { UnprocessableEntityException } from '@nestjs/common';
import { IsIn, MaxLength, MinLength } from 'class-validator';
import { TranslatedValidationPipe } from './translated-validation.pipe';

class Dto {
  @MaxLength(255, { message: 'MAX_LENGTH' })
  title: string;

  @MinLength(4, { message: 'MIN_LENGTH' })
  username: string;

  @IsIn(['draft', 'published'], { message: 'IS_ENUM' })
  status: string;
}

describe('TranslatedValidationPipe placeholders', () => {
  it('fills $constraint1 from the decorator arguments', async () => {
    const pipe = new TranslatedValidationPipe();
    const errors = await pipe
      .transform(
        { title: 'x'.repeat(300), username: 'ab', status: 'gone' },
        { type: 'body', metatype: Dto },
      )
      .then(
        () => null,
        (e: UnprocessableEntityException) => (e.getResponse() as any).errors,
      );
    expect(errors.title.en).toContain('255');
    expect(errors.username.en).toContain('4');
    expect(errors.status.en).toContain('draft, published');
    expect(JSON.stringify(errors)).not.toContain('$constraint');
  });
});
