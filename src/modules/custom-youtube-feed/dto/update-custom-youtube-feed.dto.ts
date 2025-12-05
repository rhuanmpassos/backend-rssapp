import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateCustomYouTubeFeedDto {
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
  channelId?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  channelUrl?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;
}

