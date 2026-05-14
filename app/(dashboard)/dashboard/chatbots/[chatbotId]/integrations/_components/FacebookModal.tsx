"use client";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";

interface FacebookModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loadingPages: boolean;
  fbPages: any[];
  selectedPageId: string | null;
  onSelectPage: (id: string) => void;
  onConnect: () => void;
}

export const FacebookModal = ({
  open,
  onOpenChange,
  loadingPages,
  fbPages,
  selectedPageId,
  onSelectPage,
  onConnect
}: FacebookModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle>Connect Facebook Page</DialogTitle>
          <DialogDescription>
            Select the Facebook page you want to connect to this chatbot.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
          {loadingPages ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-2 text-primary" />
              <p className="text-sm">Fetching your pages...</p>
            </div>
          ) : fbPages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">No Facebook pages found.</p>
              <p className="text-xs mt-1">Make sure you granted permission for the pages.</p>
            </div>
          ) : (
            fbPages.map(page => (
              <div 
                key={page.id} 
                onClick={() => onSelectPage(page.id)}
                className={`flex items-center gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                  selectedPageId === page.id 
                    ? "border-primary bg-primary/5 ring-1 ring-primary/20" 
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0 border border-border/50">
                  {page.picture?.data?.url ? (
                    <img src={page.picture.data.url} alt={page.name} className="w-full h-full object-cover" />
                  ) : (
                    page.name.charAt(0)
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate text-foreground">{page.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{page.category}</p>
                </div>
                {selectedPageId === page.id && (
                  <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                )}
              </div>
            ))
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Cancel</Button>
          <Button 
            onClick={onConnect} 
            disabled={!selectedPageId || loadingPages}
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            {loadingPages ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Connect Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
