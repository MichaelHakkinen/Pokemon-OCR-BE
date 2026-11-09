import { Controller, Get, Post, Res, Body, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@Controller()
export class AppController {
  @ApiTags('Healthz')
  @ApiOperation({
    summary: 'Healthz',
    description:
      'Returns a raw (non-enveloped) health status object. Used by uptime/monitoring probes.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  @Get('healthz')
  healthz(@Res() res: Response): Response {
    return res.status(200).json({ status: 'ok' });
  }

  @ApiTags('Root')
  @ApiOperation({
    summary: 'Root',
    description:
      "Returns the standard success envelope with data: null. Useful as a basic 'API is up' check.",
  })
  @ApiResponse({
    status: 200,
    description: 'Default success envelope with no data',
    schema: {
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Data retrieved successfully' },
        data: { nullable: true, example: null },
      },
    },
  })
  @Get()
  getHello() {
    return null;
  }

  @ApiTags('Root')
  @ApiOperation({
    summary: 'Root',
    description:
      'Wraps whatever JSON body is sent in the request inside the standard success envelope, echoing it back as `data`.',
  })
  @ApiResponse({
    status: 200,
    description: 'Success envelope echoing back the request body as data',
    schema: {
      properties: {
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Data retrieved successfully' },
        data: {
          type: 'object',
          description: 'Echo of the request body',
          example: { foo: 'bar' },
        },
      },
    },
  })
  @Post()
  @HttpCode(200)
  testPost(@Body() body: any) {
    return body;
  }
}
