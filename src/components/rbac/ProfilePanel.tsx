import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Camera, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { profileSchema, type ProfileValues } from "@/lib/rbac-schemas";

export function ProfilePanel() {
  const { user } = useAuth();
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "Ava", lastName: "Chen",
      email: user?.email ?? "you@cloudguest.io",
      mobile: "+1 555 010 2200", language: "en", timezone: "America/New_York",
      notifyEmail: true, notifySms: false, notifyPush: true,
    },
  });

  useEffect(() => { if (user?.email) form.setValue("email", user.email); }, [user, form]);

  const submit = (v: ProfileValues) => { console.log(v); toast.success("Profile saved"); };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold">Profile</h3>
          <p className="text-xs text-muted-foreground">Update your personal details and preferences.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-500 text-2xl font-bold text-white">
            {form.watch("firstName")[0]}{form.watch("lastName")[0]}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm"><Camera className="me-1.5 h-4 w-4" /> Change avatar</Button>
            <Button variant="ghost" size="sm">Remove</Button>
          </div>
        </div>
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-3 sm:grid-cols-2">
          <F label="First name"><Input {...form.register("firstName")} /></F>
          <F label="Last name"><Input {...form.register("lastName")} /></F>
          <F label="Email"><Input type="email" {...form.register("email")} /></F>
          <F label="Mobile"><Input {...form.register("mobile")} /></F>
          <F label="Language">
            <Controller control={form.control} name="language" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </F>
          <F label="Timezone">
            <Controller control={form.control} name="timezone" render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York</SelectItem>
                  <SelectItem value="Europe/London">Europe/London</SelectItem>
                  <SelectItem value="Asia/Kolkata">Asia/Kolkata</SelectItem>
                  <SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem>
                </SelectContent>
              </Select>
            )} />
          </F>

          <div className="sm:col-span-2 rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Notification preferences</p>
            <SwitchRow label="Email notifications" checked={form.watch("notifyEmail")} onChange={(v) => form.setValue("notifyEmail", v)} />
            <SwitchRow label="SMS notifications" checked={form.watch("notifySms")} onChange={(v) => form.setValue("notifySms", v)} />
            <SwitchRow label="Push notifications" checked={form.watch("notifyPush")} onChange={(v) => form.setValue("notifyPush", v)} />
          </div>

          <div className="sm:col-span-2 flex flex-wrap justify-between gap-2">
            <Button type="button" variant="outline"><KeyRound className="me-1.5 h-4 w-4" /> Change password</Button>
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
