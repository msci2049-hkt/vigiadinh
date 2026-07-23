import { createFileRoute } from "@tanstack/react-router";
import { SignupForm } from "@/features/auth/components/signup-form";

export const Route = createFileRoute("/sign-up")({
  component: SignUpPage,
});

function SignUpPage() {
  return <SignupForm />;
}
