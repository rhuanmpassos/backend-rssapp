import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsIn } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
    description: 'Expo push notification token',
  })
  @IsNotEmpty()
  @IsString()
  token: string;

  @ApiProperty({
    example: 'android',
    description: 'Device platform',
    enum: ['ios', 'android', 'web'],
  })
  @IsNotEmpty()
  @IsIn(['ios', 'android', 'web'])
  platform: string;
}



