"use client";

import { useUser, useClerk } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { Mail, Calendar, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";

export function AccountOverview() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  const name     = user?.fullName || "User";
  const email    = user?.primaryEmailAddress?.emailAddress || "";
  const image    = user?.imageUrl || "";
  const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const joinedAt = user?.createdAt ? format(new Date(user.createdAt), "MMMM d, yyyy") : "—";

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl border border-border bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-border">
            <AvatarImage src={image} />
            <AvatarFallback className="text-lg font-bold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold">{name}</h2>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
              <Mail className="w-3.5 h-3.5" />{email}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3" />Member since {joinedAt}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="rounded-xl shrink-0" onClick={() => openUserProfile()}>
          <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Edit Profile
        </Button>
      </div>
    </motion.div>
  );
}
