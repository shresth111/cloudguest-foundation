import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLocation } from "@/hooks/useLocations";
import { locationService } from "@/services/location.service";
import { PROPERTY_TYPE_LABEL, type PropertyType } from "@/types/location";
import type { AppError } from "@/services/api";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const schema = z.object({
  organizationId: z.string().min(1, "Select an organization"),
  name: z.string().trim().min(1, "Name is required").max(200),
  slug: z.string().trim().min(1, "Slug is required").max(150).regex(SLUG_PATTERN, "Lowercase letters, numbers, and hyphens only"),
  propertyType: z.string().optional(),
  addressLine1: z.string().trim().min(1, "Address is required").max(255),
  city: z.string().trim().min(1, "City is required").max(100),
  stateProvince: z.string().trim().min(1, "State is required").max(100),
  postalCode: z.string().trim().min(1, "Postal code is required").max(20),
  country: z.string().trim().length(2, "2-letter country code (e.g. US)").toUpperCase(),
  timezone: z.string().min(1, "Timezone is required"),
});

type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = {
  organizationId: "",
  name: "",
  slug: "",
  propertyType: "",
  addressLine1: "",
  city: "",
  stateProvince: "",
  postalCode: "",
  country: "",
  timezone: "UTC",
};

const TIMEZONES = ["UTC", "America/Los_Angeles", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Dubai"];

export function LocationWizard({ open, onOpenChange }: Props) {
  const create = useCreateLocation();
  const { data: orgs = [] } = useQuery({
    queryKey: ["locations", "org-options"],
    queryFn: () => locationService.organizations(),
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULTS,
  });

  async function submit(values: FormValues) {
    try {
      const loc = await create.mutateAsync({
        organizationId: values.organizationId,
        name: values.name,
        slug: values.slug,
        propertyType: (values.propertyType || undefined) as PropertyType | undefined,
        addressLine1: values.addressLine1,
        city: values.city,
        stateProvince: values.stateProvince,
        postalCode: values.postalCode,
        country: values.country,
        timezone: values.timezone,
      });
      toast.success(`${loc.name} created`);
      onOpenChange(false);
      form.reset(DEFAULTS);
    } catch (err) {
      toast.error((err as AppError).message || "Failed to create location");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) form.reset(DEFAULTS); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add location</DialogTitle>
          <DialogDescription>Add a new location to an organization you manage.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-4">
            <FormField control={form.control} name="organizationId" render={({ field }) => (
              <FormItem>
                <FormLabel>Organization</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="name" label="Location name" placeholder="Downtown Branch" form={form} />
              <TextField name="slug" label="Slug" placeholder="downtown-branch" form={form} />
            </div>

            <FormField control={form.control} name="propertyType" render={({ field }) => (
              <FormItem>
                <FormLabel>Property type (optional)</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select property type" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(Object.keys(PROPERTY_TYPE_LABEL) as PropertyType[]).map((t) => (
                      <SelectItem key={t} value={t}>{PROPERTY_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <TextField name="addressLine1" label="Address" placeholder="123 Main St" form={form} />

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField name="city" label="City" form={form} />
              <TextField name="stateProvince" label="State / Region" form={form} />
              <TextField name="postalCode" label="Postal code" form={form} />
              <TextField name="country" label="Country code" placeholder="US" form={form} />
            </div>

            <FormField control={form.control} name="timezone" render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {TIMEZONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add location
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TextField({ name, label, placeholder, form }: { name: any; label: string; placeholder?: string; form: any }) {
  return (
    <FormField control={form.control} name={name} render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl><Input placeholder={placeholder} {...field} /></FormControl>
        <FormMessage />
      </FormItem>
    )} />
  );
}
