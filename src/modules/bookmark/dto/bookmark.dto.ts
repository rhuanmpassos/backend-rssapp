import { IsString, IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBookmarkDto {
  @IsString()
  itemType: 'feed' | 'video';

  @IsString()
  itemId: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  excerpt?: string;

  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @IsString()
  url: string;

  @IsString()
  source: string;

  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @IsOptional()
  @IsDateString()
  savedAt?: string;
}

export class SyncBookmarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBookmarkDto)
  bookmarks: CreateBookmarkDto[];

  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;
}
