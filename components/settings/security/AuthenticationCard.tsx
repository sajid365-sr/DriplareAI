"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { ShieldCheck, Lock, Smartphone, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

export function AuthenticationCard() {
  const { openUserProfile } = useClerk();
  const { user } = useUser();

  const lastSignIn = user?.lastSignInAt 
    ? format(new Date(user.lastSignInAt), "MMMM d, yyyy 'at' h:mm a") 
    : "Not available";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 12 }} 
      animate={{ opacity: 1, y: 0 }}
      className="p-6 rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="flex items-center gap-2 mb-5">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <h3 className="font-bold text-xl">Authentication</h3>
      </div>

      <div className="space-y-4">
        {/* Security Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-primary/10">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-base font-semibold">Password</p>
              <p className="text-sm text-muted-foreground mt-0.5">Manage your password and security questions.</p>
            </div>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 border border-border flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-emerald-500/10">
              <Smartphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-base font-semibold">Two-Factor Auth</p>
              <p className="text-sm text-muted-foreground mt-0.5">Add an extra layer of security to your account.</p>
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="pt-5 border-t border-border">
          <div className="flex items-center justify-between text-base">
            <span className="text-muted-foreground">Last sign-in activity:</span>
            <span className="font-medium text-foreground">{lastSignIn}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex justify-start">
          <Button 
            size="lg"
            className="w-fit px-10 rounded-xl gap-2 mt-2 font-semibold shadow-md hover:shadow-lg transition-all" 
            onClick={() => openUserProfile()}
          >
            Manage Account Security
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          You will be redirected to our secure identity manager to update your credentials.
        </p>
      </div>
    </motion.div>
  );
}
