import { IsNotEmpty, IsNumber, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class BannerSortingDto {
  @ApiProperty({
    description: 'Id of the banner to reposition',
    example: 'b3f1c2a0-6e4d-4b8a-9c1e-2f0a1d4e5c6b',
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsUUID('all', { message: 'IS_UUID' })
  id: string;

  @ApiProperty({
    description: 'New 1-based position for the banner among all banners',
    example: 2,
    minimum: 1,
  })
  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsNumber({}, { message: 'IS_NUMBER' })
  @Min(1, { message: 'MIN_VALUE' })
  @Type(() => Number)
  newPosition: number;
}
