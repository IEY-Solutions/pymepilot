import ForgotPasswordForm from "./forgot-password-form";

type SearchParams = {
  reason?: string | string[];
};

type ForgotPasswordPageProps = {
  searchParams?: Promise<SearchParams> | SearchParams;
};

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const reasonParam = resolvedSearchParams?.reason;
  const recoveryReason = Array.isArray(reasonParam) ? reasonParam[0] : reasonParam ?? null;

  return <ForgotPasswordForm recoveryReason={recoveryReason} />;
}
