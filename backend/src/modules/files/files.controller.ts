import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import {
  CurrentUser,
  JwtAuthGuard,
  ParseUuidPipe,
  Roles,
  RolesGuard,
  zodPipe,
  type AuthPrincipal,
} from '../../common';
import { FilesService } from './files.service';
import { InitUploadSchema, ListFilesQuerySchema } from './files.dto';
import { UserRole } from '@prisma/client';

@ApiTags('Files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly svc: FilesService) {}

  @Post('upload')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        ownerType: { type: 'string' },
        ownerId: { type: 'string' },
        visibility: { type: 'string', enum: ['PRIVATE', 'INTERNAL', 'PUBLIC'] },
      },
      required: ['file', 'ownerType'],
    },
  })
  @ApiOperation({ summary: 'Upload a file (multipart/form-data)' })
  async upload(
    @UploadedFile() file: any,
    @Body() raw: any,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    if (!file) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'file is required' });
    const parsed = InitUploadSchema.parse({
      ownerType: raw.ownerType,
      ownerId: raw.ownerId || undefined,
      visibility: raw.visibility || undefined,
      filename: file.originalname,
      mimeType: file.mimetype,
    });
    return this.svc.upload(parsed, file.buffer, user, ctx(req));
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'List files (filtered by ownerType/ownerId, role-scoped)' })
  async list(@Query(zodPipe(ListFilesQuerySchema)) q: any, @CurrentUser() user: AuthPrincipal) {
    return this.svc.list(q, user);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Get file metadata' })
  async getOne(@Param('id', ParseUuidPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.svc.findById(id, user);
  }

  @Get(':id/stream')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Redirect to the Cloudinary secure URL (validates access first)' })
  async stream(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Res() res: Response,
  ) {
    const f = await this.svc.findById(id, user);
    res.redirect(f.secureUrl);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.OFFICER, UserRole.MANAGER, UserRole.VENDOR)
  @ApiOperation({ summary: 'Soft-delete a file (uploader or admin only)' })
  async remove(
    @Param('id', ParseUuidPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
    @Req() req: Request,
  ) {
    return this.svc.softDelete(id, user, ctx(req));
  }
}

function ctx(req: Request) {
  return {
    ipAddress: (req.ip as string) || (req.headers['x-forwarded-for'] as string) || undefined,
    userAgent: req.headers['user-agent'] as string | undefined,
    requestId: (req as any).id as string | undefined,
  };
}
