"use client";

import { useUser } from "@clerk/nextjs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { user } = useUser();
  const name = user?.fullName || "";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const image = user?.imageUrl || "";

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="p-6 rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16">
            <AvatarImage src={image} />
            <AvatarFallback>{name?.[0]}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold text-lg">{name}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Name *</Label>
            <Input defaultValue={name} className="mt-1" data-testid="settings-name" />
          </div>
          <div>
            <Label>Email *</Label>
            <Input defaultValue={email} disabled className="mt-1" data-testid="settings-email" />
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button className="rounded-xl px-6" data-testid="settings-save">Save Changes</Button>
        </div>
      </div>
      
      <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive font-bold text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-destructive" /> Danger Zone
          </div>
          <span className="text-xs text-destructive">Please be certain</span>
        </div>
        
        <div>
          <h3 className="font-bold">Delete account</h3>
          <p className="text-sm text-destructive/80 mt-1 mb-4">
            Once you delete your account, there is no going back. Please be certain. All your uploaded data and trained agents will be deleted. This action is not reversible.
          </p>
          <div className="flex justify-end">
            <Button variant="destructive" className="rounded-xl px-6 bg-destructive hover:bg-destructive/90 text-white">
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
