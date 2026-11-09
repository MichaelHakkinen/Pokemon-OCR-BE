import { Transform } from 'class-transformer';
import { toBoolean } from 'src/common/helpers/transform.helper';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsSafeLink } from 'src/common/helpers/link.helper';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannerDto {
  @ApiPropertyOptional({
    description: 'Banner title',
    example: 'Summer Sale 2026',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Banner subtitle',
    example: 'Up to 50% off on selected items',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  subtitle?: string;

  @ApiPropertyOptional({
    description: 'Destination URL the banner links to when clicked',
    example: 'https://example.com/promo/summer-sale',
    // http(s) URL or an app path like /promo/123 (see isSafeLink)
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(2048, { message: 'MAX_LENGTH' })
  @IsSafeLink()
  urlTarget?: string;

  @ApiPropertyOptional({
    description: 'Whether the banner is active. Defaults to true when omitted',
    example: true,
    default: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @ApiPropertyOptional({
    description: 'Banner title',
    example: 'Summer Sale 2026',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  title?: string;

  @ApiPropertyOptional({
    description: 'Banner subtitle',
    example: 'Up to 50% off on selected items',
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(255, { message: 'MAX_LENGTH' })
  subtitle?: string;

  @ApiPropertyOptional({
    description: 'Destination URL the banner links to when clicked',
    example: 'https://example.com/promo/summer-sale',
    // http(s) URL or an app path like /promo/123 (see isSafeLink)
  })
  @IsOptional()
  @IsString({ message: 'IS_STRING' })
  @MaxLength(2048, { message: 'MAX_LENGTH' })
  @IsSafeLink()
  urlTarget?: string;

  @ApiPropertyOptional({
    description: 'Whether the banner is active',
    example: true,
  })
  @Transform(toBoolean)
  @IsBoolean({ message: 'IS_BOOLEAN' })
  @IsOptional()
  isActive?: boolean;
}
