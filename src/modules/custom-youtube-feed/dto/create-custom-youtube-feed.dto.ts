import { IsString, IsNotEmpty, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class CreateCustomYouTubeFeedDto {
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
  channelId?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  channelUrl?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

