import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

export * from "./field-select";

export function SessionFieldInput({
  id,
  label,
  className,
  labelClassName,
  inputClassName,
  ...inputProps
}: {
  id?: string;
  label: string;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
} & ComponentProps<typeof Input>) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={id}
        className={cn("text-sm text-muted-foreground", labelClassName)}
      >
        {label}
      </Label>
      <Input
        id={id}
        className={cn("h-10 rounded-xl bg-background/90", inputClassName)}
        {...inputProps}
      />
    </div>
  );
}

export function SessionFieldTextarea({
  id,
  label,
  className,
  labelClassName,
  textareaClassName,
  ...textareaProps
}: {
  id?: string;
  label: string;
  className?: string;
  labelClassName?: string;
  textareaClassName?: string;
} & ComponentProps<typeof Textarea>) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={id}
        className={cn("text-sm text-muted-foreground", labelClassName)}
      >
        {label}
      </Label>
      <Textarea
        id={id}
        className={cn("rounded-xl bg-background/90", textareaClassName)}
        {...textareaProps}
      />
    </div>
  );
}

export const ORG_KIND_OPTIONS = [
  { value: "company", label: "Empresa" },
  { value: "personal", label: "Pessoal" },
  { value: "community", label: "Comunidade" },
] as const;

export const PROVIDER_TYPE_OPTIONS = [
  { value: "github", label: "GitHub" },
  { value: "gitlab", label: "GitLab" },
  { value: "bitbucket", label: "Bitbucket" },
  { value: "gitea", label: "Gitea" },
  { value: "azure", label: "Azure" },
  { value: "other", label: "Outro" },
] as const;
