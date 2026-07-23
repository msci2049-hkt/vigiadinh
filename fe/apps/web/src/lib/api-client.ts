// App-configured client from @repo/core. Feature code keeps importing
// "@/lib/api-client" — this wrapper is the ONLY place that knows the base URL.
import { createApiClient } from "@repo/core";
import { env } from "./env";

export type { RequestOptions } from "@repo/core";
export { ApiError, notifyUnauthorized, setUnauthorizedHandler } from "@repo/core";

export const apiClient = createApiClient({ baseUrl: env.VITE_API_URL });
