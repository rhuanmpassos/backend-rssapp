import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateYouTubeSubscriptionDto {
  @ApiProperty({
    example: '@GoogleDevelopers',
    description:
      'YouTube channel name, handle (@username), URL, or channel ID',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  channelNameOrUrl: string;
}



