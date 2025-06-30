import { Controller, Get } from '@nestjs/common';

@Controller('example')
export class ExampleHttpController {
  @Get()
  getExample() {
    return { message: 'Hello from API Gateway Lambda!' };
  }
} 