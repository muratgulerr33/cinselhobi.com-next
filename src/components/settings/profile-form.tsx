"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { updateProfile } from "@/actions/settings";
import { useTransition } from "react";

const schema = z.object({
  name: z.string().min(2, "İsim en az 2 karakter olmalı"),
});

export function ProfileForm({ defaultName }: { defaultName: string }) {
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName },
  });

  const isDirty = form.formState.isDirty;

  function onSubmit(data: z.infer<typeof schema>) {
    startTransition(async () => {
      const res = await updateProfile(data);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success("Profil güncellendi");
        form.reset(data);
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ad Soyad</FormLabel>
              <FormControl>
                <Input placeholder="Adınız" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          disabled={!isDirty || isPending}
          className="w-full sm:w-auto"
        >
          {isPending ? "Kaydediliyor..." : "Değişiklikleri Kaydet"}
        </Button>
      </form>
    </Form>
  );
}
