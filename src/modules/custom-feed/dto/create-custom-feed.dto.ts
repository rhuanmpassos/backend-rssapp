import { IsString, IsNotEmpty, IsOptional, MaxLength, IsObject, IsUrl } from 'class-validator';

export class CreateCustomFeedDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  siteUrl?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}
