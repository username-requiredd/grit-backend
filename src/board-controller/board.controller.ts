// src/board/board.controller.ts (CORRECTED)

import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateBoardDto } from './board.dto';
import { BoardService } from './board.service';
import { Request } from 'express'; // Import Request if needed

// --- 💡 ASSUMED CUSTOM DECORATOR FOR USER ID EXTRACTION ---
// This is necessary to securely get the user ID from the JWT/Request
interface AuthenticatedRequest extends Request {
    user: { id: string }; // Assuming JwtAuthGuard adds { id: userId } to req.user
}

@Controller('boards') // Changed from 'board' to plural 'boards' for better REST convention
@UseGuards(JwtAuthGuard)
export class BoardController {

    constructor(private boardService: BoardService) {}

    // 1. CREATE BOARD: POST /boards
    // Requires a DTO in the body and the user ID from the JWT.
    @Post()
    createBoard(@Body() data: CreateBoardDto, @Req() req: AuthenticatedRequest) {
        // We securely extract the user ID from the request object added by the JwtAuthGuard
        const currentUserId = req.user.id; 
        
        // Pass the DTO and the SECURELY extracted User ID to the service
        return this.boardService.createBoard(data, currentUserId);
    }

    // 2. GET SINGLE BOARD: GET /boards/:id
    @Get(':id')
    getBoard(@Param('id') id: string) {
        // Calling the service method for a single board
        return this.boardService.getBoard(id); 
    }
    
    // 💡 OPTIONAL: GET Boards by Workspace (If needed, could be GET /workspaces/:workspaceId/boards)
    // @Get('by-workspace/:workspaceId')
    // getBoardsByWorkspace(@Param('workspaceId') workspaceId: string) {
    //     return this.boardService.getBoards(workspaceId);
    // }

    // 3. UPDATE BOARD: PATCH /boards/:id
    @Patch(':id')
    updateBoard(@Param("id") id: string, @Body() data: Partial<CreateBoardDto>) {
        // Note: Using Partial<CreateBoardDto> allows for sending only changed fields.
        return this.boardService.updateBoard(id, data);
    }

    // 4. DELETE BOARD: DELETE /boards/:id
    @Delete(':id')
    deleteBoard(@Param("id") id: string) {
        return this.boardService.deleteBoard(id);
    }
}