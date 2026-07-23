import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ScreenStub } from "@/components/screen-stub";

export const Route = createFileRoute("/_authenticated/setup/review")({
  component: SetupReviewScreen,
});

function SetupReviewScreen() {
  const { t } = useTranslation("fw");
  return <ScreenStub title={t("setup.review.title")} description={t("setup.review.description")} />;
}
