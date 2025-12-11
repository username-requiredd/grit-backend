import { IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, MaxLength } from "class-validator";

export class WorkspaceDTO {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title: string;

  @IsString()
  @MinLength(3)
  @MaxLength(100)
  slug: string;

  @IsUUID()
  @IsNotEmpty()
  ownerId: string;

}
