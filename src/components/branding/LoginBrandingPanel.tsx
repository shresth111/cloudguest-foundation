import { toast } from "sonner";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { loginBrandingSchema, type LoginBrandingFormValues } from "@/lib/branding-schemas";
import { useSaveBrand } from "@/hooks/useBranding";
import type { Brand } from "@/types/branding";

export function LoginBrandingPanel({ brand }: { brand: Brand }) {
  const save = useSaveBrand();
  const form = useForm<LoginBrandingFormValues>({
    resolver: zodResolver(loginBrandingSchema),
    defaultValues: brand.login,
  });

  useEffect(() => form.reset(brand.login), [brand.id, brand.login, form]);

  const onSubmit = (values: LoginBrandingFormValues) => {
    save.mutate({ ...brand, login: values }, { onSuccess: () => toast.success("Login branding saved") });
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-base">Login branding</CardTitle></CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 md:grid-cols-2">
          <Field label="Background URL"><Input {...form.register("background")} placeholder="https://…" /></Field>
          <Field label="Banner URL"><Input {...form.register("banner")} placeholder="https://…" /></Field>
          <Field label="Illustration URL"><Input {...form.register("illustration")} placeholder="https://…" /></Field>
          <Field label="Heading"><Input {...form.register("heading")} /></Field>
          <div className="md:col-span-2">
            <Field label="Description"><Textarea rows={3} {...form.register("description")} /></Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Footer text"><Input {...form.register("footer")} /></Field>
          </div>
          <div className="md:col-span-2">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save login branding"}</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}
