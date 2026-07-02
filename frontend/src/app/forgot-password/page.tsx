import ForgotPasswordForm from "./forgot-password-form";

type SearchParams = {
  reason?: string | string[];
};

export default function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const reasonParam = searchParams?.reason;
  const recoveryReason = Array.isArray(reasonParam) ? reasonParam[0] : reasonParam ?? null;

  return <ForgotPasswordForm recoveryReason={recoveryReason} />;
}
