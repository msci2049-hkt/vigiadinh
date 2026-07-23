import { createFileRoute } from "@tanstack/react-router";
import { UsersPage } from "@/features/users-management";

export const Route = createFileRoute("/_authenticated/_admin/admin/users")({
  component: UsersPage,
});
