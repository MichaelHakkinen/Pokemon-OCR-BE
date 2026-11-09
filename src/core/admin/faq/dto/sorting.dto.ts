import { IsNotEmpty, IsNumber, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class FAQSortingDto {
  @ApiProperty({
    description: 'Id of the FAQ to reposition',
    example: '7c1e4b2a-3d5f-4a6b-8c9d-1e2f3a4b5c6d',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsUUID('all', { message: 'IS_UUID' })
  id: string;

  @ApiProperty({
    description:
      'New 1-based position for the FAQ among its siblings (same parent and level)',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsNumber({}, { message: 'IS_NUMBER' })
  @Min(1, { message: 'MIN_VALUE' })
  @Type(() => Number)
  newPosition: number;
}
