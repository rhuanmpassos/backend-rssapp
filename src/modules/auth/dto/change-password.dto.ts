import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'currentPassword123',
    description: 'Current password',
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({
    example: 'newSecurePassword456',
    description: 'New password (min 8 characters)',
  })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  newPassword: string;
}



