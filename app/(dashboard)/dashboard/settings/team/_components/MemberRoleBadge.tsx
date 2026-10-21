import { useTranslation } from "react-i18next";

interface MemberRoleBadgeProps {
  role: string;
}

export const MemberRoleBadge = ({ role }: MemberRoleBadgeProps) => {
  const { t } = useTranslation("settings");

  switch (role?.toLowerCase()) {
    case "owner":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/25">
          {t("team.roles.owner", "Owner")}
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/25">
          {t("team.roles.admin", "Admin")}
        </span>
      );
    case "viewer":
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
          {t("team.roles.viewer", "Viewer")}
        </span>
      );
    case "agent":
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/25">
          {t("team.roles.agent", "Agent")}
        </span>
      );
  }
};

