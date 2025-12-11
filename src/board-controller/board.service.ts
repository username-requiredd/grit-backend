
import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";
import { CreateBoardDto } from "./board.dto";
import { BoardVisibility } from "./board.dto";
@Injectable()
export class BoardService {
  constructor(private prisma: PrismaService) {}

 
  async getBoard(id: string) {
    try {
      const board = await this.prisma.board.findUnique({
        where: { id },
      });

      if (!board) throw new NotFoundException("Board not found");
      return board;
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error(err);
      throw new InternalServerErrorException("Error fetching board");
    }
  }

  /**
   * Get all boards by workspace
   */
  async getBoards(workspaceId: string) {
    try {
      const boards = await this.prisma.board.findMany({
        where: { workspaceId },
      });

      return boards;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException("Error fetching boards");
    }
  }

  /**
   * Get all boards owned by a specific user
   */
  async getBoardsByOwner(ownerId: string) {
    try {
      const boards = await this.prisma.board.findMany({
        where: { ownerId },
      });

      return boards;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException("Error fetching user boards");
    }
  }


  /**
   * Create a new board (REPLACED LOGIC)
   * * @param data The validated DTO from the client.
   * @param currentUserId The ID of the authenticated user (obtained from JWT).
   */
  async createBoard(data: CreateBoardDto, currentUserId: string) {
    const { title, workspaceId, visibility, slug, description, backgroundUrl } = data;

    // 1. Authorization Check (CRITICAL)
    // Ensure the user is actually a member of the workspace.
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        userId_workspaceId: {
          userId: currentUserId,
          workspaceId: workspaceId,
        },
      },
    });

    if (!member) {
      throw new BadRequestException('User is not authorized to create boards in this workspace.');
    }

    // 2. Atomic Transaction: Create Board & Default Columns
    try {
      // Use a transaction to ensure all related records are created successfully.
      const newBoard = await this.prisma.$transaction(async (tx) => {
        
        // A. Create the Board record
        const board = await tx.board.create({
          data: {
            title,
            visibility: visibility || BoardVisibility.PRIVATE, // Use default if not provided
            ownerId: currentUserId, // Set the creator as the owner
            workspaceId: workspaceId,
            ...(slug && { slug: slug }),
            ...(description && { description: description }),
            ...(backgroundUrl && { backgroundUrl: backgroundUrl }),
          },
        });

        // B. Define and Create Default Columns
        const defaultColumns = [
          { title: 'To Do', position: 1, isFinal: false },
          { title: 'In Progress', position: 2, isFinal: false },
          { title: 'Done', position: 3, isFinal: true },
        ];

        const columnCreates = defaultColumns.map((col) => 
          tx.column.create({
            data: {
              boardId: board.id,
              title: col.title,
              position: col.position,
              isFinal: col.isFinal,
            },
          })
        );
        
        // Execute all column creation promises in parallel within the transaction
        await Promise.all(columnCreates);
        
        return board;
      });

      return newBoard;
      
    } catch (err) {
      console.error(err);
      // Prisma transaction errors are often just passed up as InternalServer errors
      throw new InternalServerErrorException("Error creating board or its default columns.");
    }
  }


  // ... (updateBoard and deleteBoard methods remain the same) ...

  /**
   * Update an existing board
   */
  async updateBoard(id: string, dto: Partial<CreateBoardDto>) {
    try {
      const board = await this.prisma.board.update({
        where: { id },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.backgroundUrl !== undefined && { backgroundUrl: dto.backgroundUrl }),
          ...(dto.visibility !== undefined && { visibility: dto.visibility }),
          // NOTE: workspaceId and ownerId changes should be highly restricted/validated in a real app
          ...(dto.workspaceId !== undefined && { workspaceId: dto.workspaceId }), 
        },
      });

      return board;
    } catch (err) {
      if (err.code === 'P2025') {
        throw new NotFoundException("Board does not exist");
      }
      console.error(err);
      throw new InternalServerErrorException("Error updating board");
    }
  }

  /**
   * Delete a board by its ID
   */
  async deleteBoard(id: string) {
    try {
      const board = await this.prisma.board.delete({
        where: { id },
      });
      return board;
    } catch (err) {
      if (err.code === 'P2025') {
        throw new NotFoundException("Board not found");
      }
      console.error(err);
      throw new InternalServerErrorException("Error deleting board");
    }
  }
}