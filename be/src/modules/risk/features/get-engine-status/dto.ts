import { z } from "zod";

export const engineStatusOutput = z.object({
  engine: z.literal("rules"),
  aiEnabled: z.boolean(),
});

export type EngineStatusOutput = z.infer<typeof engineStatusOutput>;
