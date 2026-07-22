import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { AuthLayout } from "@/components/auth/AuthLayout";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/verify-otp")({
  validateSearch: (s) => searchSchema.parse(s),
  component: VerifyOtpPage,
});

// The account password-reset flow doesn't use a numeric code — the backend
// sends a reset link (a token in the URL) via /auth/forgot-password. This
// route has no backend counterpart in that chain, so it no longer chains
// off forgot-password's success path; kept only so the URL doesn't 404 for
// anyone with an old link.
function VerifyOtpPage() {
  const { email } = Route.useSearch();

  return (
    <AuthLayout
      title="Check your email instead"
      subtitle={
        email
          ? `We don't send a verification code — look for a password reset link sent to ${email}.`
          : "We don't send a verification code — look for a password reset link in your email."
      }
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Link
        to="/forgot-password"
        className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Resend reset link
      </Link>
    </AuthLayout>
  );
}
