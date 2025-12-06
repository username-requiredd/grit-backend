import { SetMetadata } from "@nestjs/common";
import { Role } from "./roles.enum";

export const Roles = (...roles: Role[]) => {
  return SetMetadata("roles", roles);
};
