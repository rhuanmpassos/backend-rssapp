import { IsString, IsNotEmpty, IsOptional, IsUrl, IsDateString, MaxLength } from 'class-validator';

export class CreateCustomFeedItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  title: string;

  @IsString()
  @IsOptional()
  subtitle?: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  link: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @IsDateString()
  @IsOptional()
  publishedAt?: string;

  @IsString()
  @IsOptional()
  content?: string;
}

