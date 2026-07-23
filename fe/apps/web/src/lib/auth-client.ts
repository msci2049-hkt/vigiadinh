// App-configured Better Auth client from @repo/auth (session cookie,
// credentials:'include', adminClient plugin with shared access control).
// `authClient.admin.*` powers the admin panel (features/users-management).
import { createAppAuthClient } from "@repo/auth";
import { env } from "./env";

export const authClient = createAppAuthClient(env.VITE_API_URL);

export const { signIn, signUp, signOut, useSession, getSession } = authClient;

// 6-digit OTP flows (email verification + forgot-password). `emailOtp.*`:
// sendVerificationOtp / verifyEmail / requestPasswordReset / resetPassword.
export const { emailOtp } = authClient;
