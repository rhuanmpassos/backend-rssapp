import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { WebSubService } from './websub.service';

@ApiTags('websub')
@Controller('websub')
export class WebSubController {
  private readonly logger = new Logger(WebSubController.name);

  constructor(private readonly websubService: WebSubService) {}

  @Get('callback')
  @ApiOperation({ summary: 'WebSub verification callback (hub.challenge)' })
  @ApiResponse({
    status: 200,
    description: 'Returns hub.challenge for verification',
    schema: {
      type: 'string',
      example: 'challenge_string_from_hub',
    },
  })
  @ApiResponse({ status: 404, description: 'Subscription not found or invalid' })
  async verifyCallback(
    @Query('hub.topic') topic: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.mode') mode: string,
    @Query('hub.lease_seconds') leaseSeconds: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ) {
    this.logger.log(`WebSub verification: mode=${mode}, topic=${topic}`);

    const result = await this.websubService.verifyIntent(
      topic,
      challenge,
      mode,
      leaseSeconds ? parseInt(leaseSeconds, 10) : undefined,
      verifyToken,
    );

    if (result) {
      res.status(200).send(result);
    } else {
      res.status(404).send('Not Found');
    }
  }

  @Post('callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'WebSub notification callback (receives new video notifications)' })
  @ApiResponse({
    status: 200,
    description: 'Notification processed',
    schema: {
      example: { success: true, videosProcessed: 1 },
    },
  })
  async receiveNotification(
    @Req() req: Request,
    @Headers('x-hub-signature') signature: string,
    @Body() body: any,
  ) {
    this.logger.log('WebSub notification received');

    // Get raw body as string
    let rawBody: string;
    if (typeof body === 'string') {
      rawBody = body;
    } else if (Buffer.isBuffer(body)) {
      rawBody = body.toString('utf-8');
    } else {
      // If body-parser already parsed it, we need the raw
      rawBody = JSON.stringify(body);
    }

    const result = await this.websubService.handleNotification(rawBody, signature);

    return result;
  }

  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Internal/admin endpoint
  async manualSubscribe(@Body('channelId') channelId: string) {
    return this.websubService.subscribeToChannel(channelId);
  }

  @Post('renew')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint() // Internal/admin endpoint
  async renewSubscriptions() {
    return this.websubService.renewExpiringSubscriptions();
  }
}



