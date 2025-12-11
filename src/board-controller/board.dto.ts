// src/board/dto/create-board.dto.ts (Recommended new file name)

import { IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, MaxLength, IsEnum } from "class-validator";
export enum BoardVisibility {
  PRIVATE = 'PRIVATE',
  WORKSPACE = 'WORKSPACE',
  PUBLIC = 'PUBLIC',
}
// NOTE: Renamed to CreateBoardDto for standard clarity
export class CreateBoardDto { 
    @MinLength(3)
    @MaxLength(100)
    @IsString()
    @IsNotEmpty() // Added IsNotEmpty, as title is required for creation
    title: string;

    @IsOptional()
    @IsString()
    slug?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    backgroundUrl?: string;

    @IsOptional()
    @IsEnum(BoardVisibility)
    visibility?: BoardVisibility;

    // --- Relations (Provided by Client) ---

    @IsUUID()
    @IsNotEmpty()
    workspaceId: string; // The parent container ID

}

