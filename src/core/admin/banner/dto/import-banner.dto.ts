import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsFileReference } from 'src/common/helpers/file-reference.helper';
import { IsSafeLink } from 'src/common/helpers/link.helper';

// One imported row, validated with the same pipe and messages as the API.
export class ImportBannerDto {
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  title?: string;

  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  subtitle?: string;

  @IsNotEmpty({ message: 'IS_NOT_EMPTY' })
  @IsString({ message: 'IS_STRING' })
  @IsFileReference('banner')
  mediaUrl: string;

  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(2048, { message: 'MAX_LENGTH' })
  @IsSafeLink()
  urlTarget?: string;

  @IsOptional()
  @IsBoolean({ message: 'IS_BOOLEAN' })
  isActive?: boolean;
}
