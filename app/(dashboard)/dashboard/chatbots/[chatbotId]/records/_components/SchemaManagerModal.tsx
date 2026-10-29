"use client";

import { useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Table2,
  Sparkles,
  Loader2,
  Layers,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FieldDef } from "./RecordsTable";
import { useTranslation } from "react-i18next";

export interface CustomTableSchemaItem {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  isVisibleInSidebar: boolean;
  fields: FieldDef[];
  _count?: {
    records: number;
  };
}

interface SchemaManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chatbotId: string;
  schemas: CustomTableSchemaItem[];
  onSchemaCreated: () => void;
  onSchemaUpdated?: () => void;
  onSchemaDeleted: () => void;
}

const SCHEMA_TEMPLATES = [
  {
    title: "✈️ Tour Booking",
    name: "Tour Booking",
    slug: "tour_booking",
    description:
      "Collects destination inquiries, traveler counts, and preferred dates.",
    fields: [
      {
        key: "destination",
        label: "Destination",
        type: "text" as const,
        required: true,
      },
      {
        key: "travelers_count",
        label: "Travelers Count",
        type: "number" as const,
        required: true,
      },
      {
        key: "travel_date",
        label: "Travel Date",
        type: "date" as const,
        required: true,
      },
      {
        key: "departure_city",
        label: "Departure City",
        type: "text" as const,
        required: false,
      },
      {
        key: "special_requests",
        label: "Special Requests",
        type: "text" as const,
        required: false,
      },
    ],
  },
  {
    title: "🏥 Patient Appointment",
    name: "Doctor Appointment",
    slug: "doctor_appointment",
    description:
      "Schedules consultations with patient age, department, and time.",
    fields: [
      {
        key: "department",
        label: "Department / Doctor",
        type: "text" as const,
        required: true,
      },
      {
        key: "patient_name",
        label: "Patient Name",
        type: "text" as const,
        required: true,
      },
      {
        key: "patient_age",
        label: "Patient Age",
        type: "number" as const,
        required: true,
      },
      {
        key: "appointment_date",
        label: "Preferred Date",
        type: "date" as const,
        required: true,
      },
      {
        key: "time_slot",
        label: "Time Slot",
        type: "select" as const,
        required: false,
      },
    ],
  },
  {
    title: "🍔 Table Reservation",
    name: "Table Reservation",
    slug: "table_reservation",
    description:
      "Handles restaurant table reservations with guest count and time.",
    fields: [
      {
        key: "guest_count",
        label: "Number of Guests",
        type: "number" as const,
        required: true,
      },
      {
        key: "reservation_date",
        label: "Date",
        type: "date" as const,
        required: true,
      },
      {
        key: "reservation_time",
        label: "Time",
        type: "text" as const,
        required: true,
      },
      {
        key: "seating_preference",
        label: "Seating",
        type: "select" as const,
        required: false,
      },
    ],
  },
  {
    title: "🎓 Course Admission",
    name: "Course Inquiry",
    slug: "course_inquiry",
    description:
      "Captures prospective student leads for coaching or online courses.",
    fields: [
      {
        key: "course_name",
        label: "Course Name",
        type: "text" as const,
        required: true,
      },
      {
        key: "student_name",
        label: "Student Name",
        type: "text" as const,
        required: true,
      },
      {
        key: "education_level",
        label: "Current Education",
        type: "text" as const,
        required: false,
      },
      {
        key: "class_mode",
        label: "Online / Offline",
        type: "select" as const,
        required: true,
      },
    ],
  },
  {
    title: "🏡 Property Site Visit",
    name: "Site Visit Request",
    slug: "site_visit",
    description:
      "Schedules physical property inspection visits with budget preferences.",
    fields: [
      {
        key: "property_type",
        label: "Property Type",
        type: "select" as const,
        required: true,
      },
      {
        key: "budget_range",
        label: "Budget Range",
        type: "text" as const,
        required: false,
      },
      {
        key: "preferred_location",
        label: "Preferred Area",
        type: "text" as const,
        required: true,
      },
      {
        key: "visit_date",
        label: "Preferred Visit Date",
        type: "date" as const,
        required: true,
      },
    ],
  },
];

export function SchemaManagerModal({
  open,
  onOpenChange,
  chatbotId,
  schemas,
  onSchemaCreated,
  onSchemaUpdated,
  onSchemaDeleted,
}: SchemaManagerModalProps) {
  const { t } = useTranslation("business-data");
  const [isCreating, setIsCreating] = useState(false);
  const [editingSchema, setEditingSchema] =
    useState<CustomTableSchemaItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomTableSchemaItem | null>(null);
  const [visibilityUpdatingId, setVisibilityUpdatingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<FieldDef[]>([
    { key: "notes", label: "Inquiry Details", type: "text", required: true },
  ]);

  const handleStartCreate = () => {
    setEditingSchema(null);
    setName("");
    setSlug("");
    setDescription("");
    setFields([
      { key: "notes", label: "Inquiry Details", type: "text", required: true },
    ]);
    setIsCreating(true);
  };

  const handleStartEdit = (schema: CustomTableSchemaItem) => {
    setEditingSchema(schema);
    setName(schema.name);
    setSlug(schema.slug);
    setDescription(schema.description || "");
    setFields(
      schema.fields && schema.fields.length > 0
        ? JSON.parse(JSON.stringify(schema.fields))
        : [
            {
              key: "notes",
              label: "Inquiry Details",
              type: "text",
              required: true,
            },
          ],
    );
    setIsCreating(true);
  };

  const handleCancelForm = () => {
    setIsCreating(false);
    setEditingSchema(null);
    setName("");
    setSlug("");
    setDescription("");
    setFields([
      { key: "notes", label: "Inquiry Details", type: "text", required: true },
    ]);
  };

  const handleApplyTemplate = (tmpl: (typeof SCHEMA_TEMPLATES)[number]) => {
    setEditingSchema(null);
    setName(tmpl.name);
    setSlug(tmpl.slug);
    setDescription(tmpl.description);
    setFields([...tmpl.fields]);
    setIsCreating(true);
  };

  const handleNameChange = (val: string) => {
    setName(val);
    if (
      !editingSchema &&
      (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, "_"))
    ) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, ""),
      );
    }
  };

  const addField = () => {
    setFields((prev) => [
      ...prev,
      {
        key: `field_${prev.length + 1}`,
        label: `Custom Field ${prev.length + 1}`,
        type: "text",
        required: false,
      },
    ]);
  };

  const removeField = (index: number) => {
    if (fields.length <= 1) {
      toast.error(t("manager.fieldRequired"));
      return;
    }
    setFields((prev) => prev.filter((_, i) => i !== index));
  };

  const updateField = (index: number, patch: Partial<FieldDef>) => {
    setFields((prev) =>
      prev.map((f, i) => {
        if (i !== index) return f;
        const updated = { ...f, ...patch };
        if (patch.label && (!f.key || f.key.startsWith("field_"))) {
          updated.key = patch.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
        }
        return updated;
      }),
    );
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("manager.formNameRequired"));
      return;
    }
    if (!slug.trim()) {
      toast.error(t("manager.slugRequired"));
      return;
    }
    if (fields.length === 0) {
      toast.error(t("manager.fieldRequired"));
      return;
    }

    setSubmitting(true);
    try {
      if (editingSchema) {
        // Update existing schema (PUT)
        const res = await fetch(
          `/api/chatbots/${chatbotId}/custom-schemas/${editingSchema.id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name.trim(),
              description: description.trim() || undefined,
              fields,
            }),
          },
        );

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t("manager.updateFailed"));
          return;
        }

        toast.success(t("manager.updated", { name }));
        handleCancelForm();
        if (onSchemaUpdated) {
          onSchemaUpdated();
        } else {
          onSchemaCreated();
        }
      } else {
        // Create new schema (POST)
        const res = await fetch(`/api/chatbots/${chatbotId}/custom-schemas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            slug: slug.trim(),
            description: description.trim() || undefined,
            fields,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || t("manager.createFailed"));
          return;
        }

        toast.success(t("manager.created", { name }));
        handleCancelForm();
        onSchemaCreated();
      }
    } catch (err) {
      console.error("[SAVE_SCHEMA_ERROR]", err);
      toast.error(t("manager.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchema = async () => {
    if (!deleteTarget) return;

    const { id: schemaId, name: schemaName } = deleteTarget;
    setDeletingId(schemaId);
    try {
      const res = await fetch(
        `/api/chatbots/${chatbotId}/custom-schemas/${schemaId}`,
        {
          method: "DELETE",
        },
      );

      if (!res.ok) {
        toast.error(t("manager.deleteFailed"));
        return;
      }

      toast.success(t("manager.deleted", { name: schemaName }));
      setDeleteTarget(null);
      onSchemaDeleted();
    } catch (err) {
      console.error("[DELETE_SCHEMA_ERROR]", err);
      toast.error(t("manager.deleteError"));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSidebarVisibilityChange = async (schema: CustomTableSchemaItem, visible: boolean) => {
    setVisibilityUpdatingId(schema.id);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/custom-schemas/${schema.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVisibleInSidebar: visible }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || t("manager.sidebarUpdateFailed"));
        return;
      }
      toast.success(visible ? t("manager.shownInSidebar") : t("manager.hiddenFromSidebar"));
      onSchemaUpdated?.();
      if (!onSchemaUpdated) onSchemaCreated();
    } catch {
      toast.error(t("manager.sidebarError"));
    } finally {
      setVisibilityUpdatingId(null);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          handleCancelForm();
          setDeleteTarget(null);
        }
        onOpenChange(v);
      }}
    >
      <SheetContent
        className="sm:max-w-xl w-full p-6 space-y-6 overflow-y-auto"
        side="right"
      >
        <SheetHeader className="space-y-1 text-left border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold flex items-center gap-2">
              <Table2 className="w-5 h-5 text-primary" />
              {t("manager.title")}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            {t("manager.description")}
          </SheetDescription>
        </SheetHeader>

        {!isCreating ? (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {t("manager.configuredForms", { count: schemas.length })}
              </h4>
              <Button
                type="button"
                size="sm"
                onClick={handleStartCreate}
                className="rounded-full bg-brand-gradient text-white text-xs font-bold gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                {t("manager.newForm")}
              </Button>
            </div>

            {schemas.length === 0 ? (
              <div className="p-6 text-center rounded-2xl border border-dashed border-border bg-muted/20 space-y-3">
                <Layers className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">
                  {t("manager.noCustomForms")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {schemas.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-primary/40 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h5 className="text-sm font-bold text-foreground flex items-center gap-2">
                          {s.name === t(`formNames.${s.slug}`, { lng: "en", defaultValue: s.name })
                            ? t(`formNames.${s.slug}`, { defaultValue: s.name })
                            : s.name}
                          <Badge
                            variant="outline"
                            className="text-[10px] font-mono"
                          >
                            {s.slug}
                          </Badge>
                        </h5>
                        {s.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                          {t("manager.records", { count: s._count?.records ?? 0 })}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleStartEdit(s)}
                          className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                          title={t("manager.editForm")}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={deletingId === s.id}
                          onClick={() => setDeleteTarget(s)}
                          className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                          title={t("manager.deleteForm")}
                        >
                          {deletingId === s.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-2">
                      <Label htmlFor={`sidebar-visible-${s.id}`} className="text-xs text-muted-foreground">
                        {t("manager.showInSidebar")}
                      </Label>
                      <Switch
                        id={`sidebar-visible-${s.id}`}
                        checked={s.isVisibleInSidebar !== false}
                        disabled={visibilityUpdatingId === s.id}
                        onCheckedChange={(checked) => handleSidebarVisibilityChange(s, checked)}
                        aria-label={`${t("manager.showInSidebar")}: ${s.name}`}
                      />
                    </div>

                    <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
                      {(s.fields || []).map((f) => (
                        <span
                          key={f.key}
                          className="text-[10px] bg-muted/70 text-muted-foreground px-2 py-0.5 rounded-md"
                        >
                          {f.label} ({f.type})
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick 1-click Templates */}
            <div className="space-y-3 pt-2">
              <h5 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-primary" />
                {t("manager.templates")}
              </h5>
              <div className="grid grid-cols-1 gap-2">
                {SCHEMA_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.slug}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all text-left cursor-pointer group"
                  >
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {t(`templates.${tmpl.slug}.title`, { defaultValue: tmpl.title })}
                      </span>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {t(`templates.${tmpl.slug}.description`, { defaultValue: tmpl.description })}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Create / Edit Form Mode */
          <form onSubmit={handleFormSubmit} className="space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2 min-w-0">
                {editingSchema ? (
                  <Pencil className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-primary shrink-0" />
                )}
                <h4 className="text-sm font-bold text-foreground truncate">
                  {editingSchema
                    ? t("manager.editTitle", { name: editingSchema.name === t(`formNames.${editingSchema.slug}`, { lng: "en", defaultValue: editingSchema.name }) ? t(`formNames.${editingSchema.slug}`, { defaultValue: editingSchema.name }) : editingSchema.name })
                    : t("manager.createTitle")}
                </h4>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelForm}
                className="text-xs cursor-pointer shrink-0"
              >
                {t("manager.cancel")}
              </Button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">{t("manager.formName")}</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder={t("manager.formNamePlaceholder")}
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">
                    {t("manager.schemaSlug")}
                  </Label>
                  {editingSchema && (
                    <span className="text-[10px] text-muted-foreground italic">
                      {t("manager.readOnly")}
                    </span>
                  )}
                </div>
                <Input
                  value={slug}
                  disabled={!!editingSchema}
                  onChange={(e) =>
                    setSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""),
                    )
                  }
                  placeholder={t("manager.slugPlaceholder")}
                  className={`font-mono text-xs ${editingSchema ? "bg-muted/50 cursor-not-allowed opacity-80" : ""}`}
                  required
                />
                {editingSchema && (
                  <p className="text-[10px] text-muted-foreground">
                    {t("manager.slugLocked")}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {t("manager.descriptionLabel")}
                </Label>
                <Textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("manager.descriptionPlaceholder")}
                />
              </div>
            </div>

            {/* Fields List */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {t("manager.fields", { count: fields.length })}
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addField}
                  className="h-7 text-xs rounded-full gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" /> {t("manager.addField")}
                </Button>
              </div>

              <div className="space-y-2.5">
                {fields.map((field, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl border border-border bg-card space-y-2 text-xs"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {t("manager.fieldLabel")}
                        </span>
                        <Input
                          value={field.label}
                          onChange={(e) =>
                            updateField(idx, { label: e.target.value })
                          }
                          placeholder={t("manager.fieldLabelPlaceholder")}
                          className="h-8 text-xs"
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {t("manager.fieldKey")}
                        </span>
                        <Input
                          value={field.key}
                          onChange={(e) =>
                            updateField(idx, {
                              key: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9_]/g, ""),
                            })
                          }
                          placeholder="field_key"
                          className="h-8 text-xs font-mono"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Select
                          value={field.type}
                          onValueChange={(val) =>
                            updateField(idx, { type: val as FieldDef["type"] })
                          }
                        >
                          <SelectTrigger className="h-7 text-xs w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">{t("manager.text")}</SelectItem>
                            <SelectItem value="number">{t("manager.number")}</SelectItem>
                            <SelectItem value="date">{t("manager.date")}</SelectItem>
                            <SelectItem value="phone">{t("manager.phone")}</SelectItem>
                            <SelectItem value="select">{t("manager.dropdown")}</SelectItem>
                            <SelectItem value="boolean">{t("manager.yesNo")}</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(checked) =>
                              updateField(idx, { required: checked })
                            }
                          />
                          <span className="text-[11px] text-muted-foreground">
                            {t("manager.required")}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(idx)}
                        className="w-7 h-7 text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>

                    {field.type === "select" && (
                      <div className="pt-1.5 space-y-1">
                        <span className="text-[10px] text-muted-foreground font-semibold">
                          {t("manager.dropdownOptions")}
                        </span>
                        <Input
                          value={(field.options || []).join(", ")}
                          onChange={(e) =>
                            updateField(idx, {
                              options: e.target.value
                                .split(",")
                                .map((s) => s.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder={t("manager.optionsPlaceholder")}
                          className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-brand-gradient text-white font-bold rounded-full gap-2 shadow-md cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />{" "}
                  {editingSchema ? t("manager.updating") : t("manager.saving")}
                </>
              ) : editingSchema ? (
                t("manager.updateChanges")
              ) : (
                t("manager.saveActivate")
              )}
            </Button>
          </form>
        )}

        <Dialog
          open={deleteTarget !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen && !deletingId) setDeleteTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t("manager.deleteConfirmTitle")}</DialogTitle>
              <DialogDescription>
                {deleteTarget && t("manager.confirmDelete", { name: deleteTarget.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={deletingId !== null}
                onClick={() => setDeleteTarget(null)}
              >
                {t("manager.cancel")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={deletingId !== null}
                onClick={() => void handleDeleteSchema()}
                className="gap-2"
              >
                {deletingId !== null && <Loader2 className="h-4 w-4 animate-spin" />}
                {deletingId !== null ? t("manager.deleting") : t("manager.deleteForm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}
