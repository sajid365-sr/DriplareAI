"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface WhatsAppModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  form: { accessToken: string; phoneNumberId: string; wabaId: string };
  onFormChange: (form: any) => void;
  onConnect: () => void;
}

export const WhatsAppModal = ({
  open,
  onOpenChange,
  loading,
  form,
  onFormChange,
  onConnect
}: WhatsAppModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Connect WhatsApp Business</DialogTitle>
          <DialogDescription>
            Enter your Meta WhatsApp Business API credentials. You can find these in your Meta Developer Portal.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">System User Access Token</label>
            <input 
              className="w-full p-3 rounded-2xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              placeholder="EAAG..."
              value={form.accessToken}
              onChange={(e) => onFormChange({...form, accessToken: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">Phone Number ID</label>
            <input 
              className="w-full p-3 rounded-2xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              placeholder="1092..."
              value={form.phoneNumberId}
              onChange={(e) => onFormChange({...form, phoneNumberId: e.target.value})}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-foreground">WhatsApp Business Account ID</label>
            <input 
              className="w-full p-3 rounded-2xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none"
              placeholder="1029..."
              value={form.wabaId}
              onChange={(e) => onFormChange({...form, wabaId: e.target.value})}
            />
          </div>
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button 
            onClick={onConnect} 
            disabled={loading}
            className="rounded-xl bg-[#25D366] hover:bg-[#20bd5c] text-white border-0 shadow-lg shadow-green-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Connect WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
