import { z } from "zod";
import { notificationStatusEnum } from "../../domain/validators";

export const listNotificationsQuery = z.object({
  status: notificationStatusEnum.optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;
