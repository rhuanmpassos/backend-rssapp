import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { UpdateFolderDto } from './dto/update-folder.dto';
import { User } from '@prisma/client';

@Controller('folders')
@UseGuards(JwtAuthGuard)
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  create(@CurrentUser() user: User, @Body() dto: CreateFolderDto) {
    return this.folderService.create(user.id, dto);
  }

  @Get()
  findAll(@CurrentUser() user: User) {
    return this.folderService.findAll(user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: User, @Param('id') id: string) {
    return this.folderService.findOne(user.id, id);
  }

  @Put(':id')
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateFolderDto,
  ) {
    return this.folderService.update(user.id, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.folderService.delete(user.id, id);
  }

  @Post('reorder')
  reorder(@CurrentUser() user: User, @Body() body: { folderIds: string[] }) {
    return this.folderService.reorder(user.id, body.folderIds);
  }
}

