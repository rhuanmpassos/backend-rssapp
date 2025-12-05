import { IsString, IsOptional, MaxLength, IsObject, IsUrl } from 'class-validator';

export class UpdateCustomFeedDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  slug?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  siteUrl?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}
