"use client";

import { useTranslation } from "react-i18next";
import { Trash2, Shield, User, Mail, Calendar, CheckCircle2 } from "lucide-react";
import { MemberRoleBadge } from "./MemberRoleBadge";

export interface TeamMemberItem {
  id: string;
  workspaceId: string;
  userId?: string | null;
  name: string;
  email: string;
  role: string;
  status: string;
  picture?: string | null;
  createdAt: string;
}

interface TeamMemberListProps {
  members: TeamMemberItem[];
  ownerId: string;
  currentUserId: string;
  onRemove: (member: TeamMemberItem) => void;
}

export const TeamMemberList = ({
  members,
  ownerId,
  currentUserId,
  onRemove,
}: TeamMemberListProps) => {
  const { t } = useTranslation("settings");

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12.5px]">
          <thead className="bg-muted/40 border-b border-border/60 text-muted-foreground uppercase text-[10.5px] font-bold tracking-wider">
            <tr>
              <th className="py-3 px-4">{t("team.table.member")}</th>
              <th className="py-3 px-4">{t("team.table.email")}</th>
              <th className="py-3 px-4">{t("team.table.role")}</th>
              <th className="py-3 px-4">{t("team.table.status")}</th>
              <th className="py-3 px-4 text-right">{t("team.table.actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {members.map((member) => {
              const isOwner = member.role === "owner" || member.userId === ownerId;
              const isCurrentUser = member.userId === currentUserId;

              return (
                <tr
                  key={member.id}
                  className="hover:bg-muted/30 transition-colors"
                >
                  {/* Name + Avatar */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      {member.picture ? (
                        <img
                          src={member.picture}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover border border-border/60"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center border border-primary/20">
                          {member.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          {member.name}
                          {isCurrentUser && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              (You)
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="py-3 px-4 text-muted-foreground font-mono text-[11.5px]">
                    {member.email}
                  </td>

                  {/* Role */}
                  <td className="py-3 px-4">
                    <MemberRoleBadge role={member.role} />
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      {t(`team.status.${member.status}`, member.status)}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right">
                    {!isOwner && (
                      <button
                        onClick={() => onRemove(member)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                        title={t("team.removeModal.confirm")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
