"use client";

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ChevronsUpDown,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useWorkspace } from "@/components/workspace-provider";
import type { Workspace } from "@/lib/core/workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Square avatar for a business: renders the uploaded logo when present,
 * otherwise a colored badge with the first letter of the business name.
 */
function WorkspaceAvatar({
  name,
  logoUrl,
  className = "h-6 w-6 text-[11px]",
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
}) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`${className} shrink-0 rounded-lg object-cover`}
      />
    );
  }
  return (
    <span
      className={`${className} flex shrink-0 items-center justify-center rounded-lg bg-purple-600 font-semibold text-white`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Multi-Business / Multi-Workspace switcher for the Top Navbar.
 * Shows the active business and lets the user switch or add a new one.
 */
export function WorkspaceSwitcher() {
  const { t } = useTranslation();
  const {
    workspaces,
    activeWorkspace,
    activeWorkspaceId,
    switchWorkspace,
    addWorkspace,
    updateWorkspace,
    deleteWorkspace,
    loading,
  } = useWorkspace();

  // Add Business modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit Business modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  // Delete Business modal state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // The business currently targeted by the edit/delete dialogs.
  const [target, setTarget] = useState<Workspace | null>(null);

  // Shared logo picker: reads the file, downscales to a small square on a canvas,
  // then hands the Base64 JPEG to `onLogo`. A raw photo's data URL can be several
  // MB — too big to store in a DB column or POST as JSON. 256px + JPEG keeps it tiny.
  const readLogoFile = (
    file: File,
    onLogo: (dataUrl: string) => void,
    onError: () => void
  ) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 256;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          onLogo(reader.result as string);
          return;
        }
        // Cover-fit: crop to a centered square, then scale into the canvas.
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        onLogo(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = onError;
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    readLogoFile(
      file,
      (dataUrl) => setLogoUrl(dataUrl),
      () => setError(t("workspace.logoError", "Could not read that image. Try another file."))
    );
  };

  const handleEditLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditError(null);
    readLogoFile(
      file,
      (dataUrl) => setEditLogoUrl(dataUrl),
      () => setEditError(t("workspace.logoError", "Could not read that image. Try another file."))
    );
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    setCreating(true);
    try {
      const workspace = await addWorkspace(trimmed, logoUrl || undefined);
      if (workspace) {
        setName("");
        setLogoUrl(null);
        setCreateOpen(false);
        switchWorkspace(workspace.workspaceId);
      } else {
        setError(t("workspace.createError", "Failed to create business. Please try again."));
      }
    } catch (err) {
      console.error("[WorkspaceSwitcher] create failed", err);
      setError(t("workspace.createError", "Failed to create business. Please try again."));
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (workspace: Workspace) => {
    setTarget(workspace);
    setEditName(workspace.name);
    setEditLogoUrl(workspace.logoUrl ?? null);
    setEditError(null);
    setTimeout(() => setEditOpen(true), 10);
  };

  const handleUpdate = async () => {
    const trimmed = editName.trim();
    if (!trimmed || !target) return;
    setEditError(null);
    setSaving(true);
    try {
      const updated = await updateWorkspace(
        target.workspaceId,
        trimmed,
        editLogoUrl || undefined
      );
      if (updated) {
        setEditOpen(false);
        setTarget(null);
      } else {
        setEditError(t("workspace.updateError", "Failed to update business. Please try again."));
      }
    } catch (err) {
      console.error("[WorkspaceSwitcher] update failed", err);
      setEditError(t("workspace.updateError", "Failed to update business. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const openDelete = (workspace: Workspace) => {
    setTarget(workspace);
    setConfirmText("");
    setDeleteError(null);
    setTimeout(() => setDeleteOpen(true), 10);
  };

  const handleDelete = async () => {
    if (!target || confirmText.trim() !== target.name) return;
    setDeleteError(null);
    setDeleting(true);
    try {
      const ok = await deleteWorkspace(target.workspaceId);
      if (ok) {
        setDeleteOpen(false);
        setTarget(null);
      } else {
        setDeleteError(t("workspace.deleteError", "Failed to delete business. Please try again."));
      }
    } catch (err) {
      console.error("[WorkspaceSwitcher] delete failed", err);
      setDeleteError(t("workspace.deleteError", "Failed to delete business. Please try again."));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-xl border border-border bg-background/60 px-2.5 py-1.5 text-sm font-medium hover:bg-muted/60 hover:border-border transition-colors outline-none data-open:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary/40"
          data-testid="workspace-switcher"
        >
          {activeWorkspace ? (
            <WorkspaceAvatar
              name={activeWorkspace.name}
              logoUrl={activeWorkspace.logoUrl}
            />
          ) : (
            <span className="h-6 w-6 shrink-0 rounded-lg bg-primary/10" />
          )}
          <span className="hidden max-w-[140px] truncate text-left sm:inline">
            {loading
              ? t("workspace.loading", "Loading…")
              : activeWorkspace?.name || t("workspace.select", "Select business")}
          </span>
          <ChevronsUpDown className="hidden h-3.5 w-3.5 shrink-0 text-muted-foreground sm:block" />
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="w-60 shadow-2xl border border-slate-100"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("workspace.label", "Businesses")}
            </DropdownMenuLabel>
            {workspaces.length === 0 && !loading && (
              <div className="px-2.5 py-2 text-xs text-muted-foreground">
                {t("workspace.empty", "No businesses yet")}
              </div>
            )}
            {workspaces.map((workspace) => {
              const isActive = workspace.workspaceId === activeWorkspaceId;
              return (
                <DropdownMenuItem
                  key={workspace.workspaceId}
                  onClick={() => switchWorkspace(workspace.workspaceId)}
                  className="group/ws flex items-center gap-2 py-1.5"
                  data-active={isActive}
                >
                  <WorkspaceAvatar
                    name={workspace.name}
                    logoUrl={workspace.logoUrl}
                  />
                  <span className="flex-1 truncate">{workspace.name}</span>
                  {isActive && <Check className="h-4 w-4 shrink-0 text-primary" />}
                  {/* Edit / delete — revealed on hover; stopPropagation so they
                      don't trigger the row's switch. */}
                  <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover/ws:flex">
                    <button
                      type="button"
                      aria-label={t("workspace.editTitle", "Rename Business")}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(workspace);
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    {workspaces.length > 1 && (
                      <button
                        type="button"
                        aria-label={t("workspace.deleteTitle", "Delete Business")}
                        onClick={(e) => {
                          e.stopPropagation();
                          openDelete(workspace);
                        }}
                        className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTimeout(() => setCreateOpen(true), 10)}
            className="flex items-center gap-2 py-1.5 text-primary"
          >
            <Plus className="h-4 w-4 shrink-0" />
            {t("workspace.addBusiness", "Add New Business")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Add New Business Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("workspace.createTitle", "Add New Business")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "workspace.createSubtitle",
                "Create a separate workspace for another business. Its AI agents, inbox, orders and integrations stay fully isolated."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Brand Logo — file picker + Base64 preview */}
            <div className="space-y-2">
              <Label>{t("workspace.logoLabel", "Brand logo")}</Label>
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logoUrl}
                      alt={t("workspace.logoPreview", "Logo preview")}
                      className="h-14 w-14 rounded-xl object-cover border border-border"
                    />
                    <button
                      type="button"
                      aria-label={t("workspace.logoRemove", "Remove logo")}
                      onClick={() => {
                        setLogoUrl(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
                <div className="text-xs text-muted-foreground">
                  {t(
                    "workspace.logoHint",
                    "Optional. PNG or JPG, square looks best."
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-name">
                {t("workspace.nameLabel", "Business name")}
              </Label>
              <Input
                id="workspace-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("workspace.namePlaceholder", "e.g. My Online Store")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && name.trim()) handleCreate();
                }}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateOpen(false);
                setLogoUrl(null);
              }}
              disabled={creating}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || creating}
              className="bg-gradient-to-r from-primary to-fuchsia-600 border-none"
            >
              {creating
                ? t("workspace.creating", "Creating…")
                : t("workspace.create", "Create Business")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit (Rename) Business Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace.editTitle", "Rename Business")}</DialogTitle>
            <DialogDescription>
              {t("workspace.editSubtitle", "Update the name of this business.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Brand Logo — file picker + Base64 preview */}
            <div className="space-y-2">
              <Label>{t("workspace.logoLabel", "Brand logo")}</Label>
              <div className="flex items-center gap-3">
                {editLogoUrl ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={editLogoUrl}
                      alt={t("workspace.logoPreview", "Logo preview")}
                      className="h-14 w-14 rounded-xl object-cover border border-border"
                    />
                    <button
                      type="button"
                      aria-label={t("workspace.logoRemove", "Remove logo")}
                      onClick={() => {
                        setEditLogoUrl(null);
                        if (editFileInputRef.current) editFileInputRef.current.value = "";
                      }}
                      className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => editFileInputRef.current?.click()}
                    className="flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
                <div className="text-xs text-muted-foreground">
                  {t(
                    "workspace.logoHint",
                    "Optional. PNG or JPG, square looks best."
                  )}
                </div>
              </div>
              <input
                ref={editFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleEditLogoChange}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workspace-edit-name">
                {t("workspace.nameLabel", "Business name")}
              </Label>
              <Input
                id="workspace-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t("workspace.namePlaceholder", "e.g. My Online Store")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && editName.trim()) handleUpdate();
                }}
                autoFocus
              />
            </div>
            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditLogoUrl(null);
              }}
              disabled={saving}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!editName.trim() || saving}
              className="bg-gradient-to-r from-primary to-fuchsia-600 border-none"
            >
              {saving ? t("workspace.saving", "Saving…") : t("workspace.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Business Modal — destructive, type-to-confirm */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {t("workspace.deleteTitle", "Delete Business")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "workspace.deleteWarning",
                "This permanently deletes this business and ALL of its data — chatbots, integrations, orders, conversations and messages. This action cannot be undone."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
              <span className="font-semibold text-foreground">{target?.name}</span>
            </div>
            <div className="space-y-2">
              <Label htmlFor="workspace-delete-confirm">
                {t("workspace.deleteConfirmLabel", "Type the business name to confirm")}
              </Label>
              <Input
                id="workspace-delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={target?.name || ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && confirmText.trim() === target?.name) {
                    handleDelete();
                  }
                }}
                autoFocus
              />
            </div>
            {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmText.trim() !== target?.name || deleting}
            >
              {deleting
                ? t("workspace.deleting", "Deleting…")
                : t("workspace.deleteConfirm", "Delete Business")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
