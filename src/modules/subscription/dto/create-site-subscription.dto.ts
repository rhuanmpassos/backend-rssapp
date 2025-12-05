import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateSiteSubscriptionDto {
  @ApiProperty({
    example: 'https://example.com',
    description: 'Website URL to subscribe to',
  })
  @IsNotEmpty()
  @IsUrl({
    require_tld: false, // Allow URLs without TLD (e.g., localhost, 10.0.2.2)
    require_protocol: true,
  }, { message: 'Please provide a valid URL' })
  url: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Optional folder ID to organize subscription',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  folderId?: string;
}



