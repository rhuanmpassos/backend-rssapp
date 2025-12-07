import { IsString, IsOptional, IsDateString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReadItemDto {
  @IsString()
  itemType: 'feed' | 'video';

  @IsString()
  itemId: string;

  @IsOptional()
  @IsDateString()
  readAt?: string;
}

export class SyncReadItemsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReadItemDto)
  readItems: CreateReadItemDto[];

  @IsOptional()
  @IsDateString()
  lastSyncAt?: string;
}
