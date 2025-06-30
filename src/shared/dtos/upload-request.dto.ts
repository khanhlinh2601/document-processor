import { IsArray, ValidateNested, IsString } from 'class-validator';
import { Type } from 'class-transformer';

class FileDto {
  @IsString()
  fileName: string;

  @IsString()
  contentType: string;

  @IsString()
  base64: string;
}

export class UploadRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FileDto)
  files: FileDto[];
} 