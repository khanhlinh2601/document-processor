export class FileEntity {
  constructor(
    public fileName: string,
    public contentType: string,
    public base64: string
  ) {}
} 