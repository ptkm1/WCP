import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type FieldSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

/** Radix Select does not accept empty string as a value. */
export const SELECT_EMPTY_VALUE = "__wcp_empty__";

export function toSelectValue(
  value: string,
  allowEmpty?: boolean,
): string | undefined {
  if (!value) {
    return allowEmpty ? SELECT_EMPTY_VALUE : undefined;
  }
  return value;
}

export function fromSelectValue(value: string, allowEmpty?: boolean): string {
  if (allowEmpty && value === SELECT_EMPTY_VALUE) {
    return "";
  }
  return value;
}

export function FieldSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  allowEmpty = false,
  emptyLabel = "Selecione",
  disabled = false,
  className,
  triggerClassName,
  labelClassName,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  labelClassName?: string;
}) {
  const resolvedOptions = allowEmpty
    ? [{ value: SELECT_EMPTY_VALUE, label: emptyLabel }, ...options]
    : options;

  return (
    <div className={cn("grid gap-2", className)}>
      <Label
        htmlFor={id}
        className={cn("text-xs text-muted-foreground", labelClassName)}
      >
        {label}
      </Label>
      <Select
        value={toSelectValue(value, allowEmpty)}
        onValueChange={(next) =>
          onValueChange(fromSelectValue(next, allowEmpty))
        }
        disabled={disabled}
      >
        <SelectTrigger
          id={id}
          disabled={disabled}
          className={cn("h-10 w-full", triggerClassName)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent position="popper" align="center" collisionPadding={12}>
          {resolvedOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** Select for sessionForm labels (text-sm label style). */
export function SessionFieldSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder = "Selecione",
  allowEmpty = false,
  emptyLabel = "Selecione",
  disabled = false,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FieldSelectOption[];
  placeholder?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <FieldSelect
      id={id}
      label={label}
      value={value}
      onValueChange={onValueChange}
      options={options}
      placeholder={placeholder}
      allowEmpty={allowEmpty}
      emptyLabel={emptyLabel}
      disabled={disabled}
      className={className}
      labelClassName="text-sm text-muted-foreground"
    />
  );
}

export function FieldCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
  className,
}: {
  id?: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  const checkboxId =
    id ?? `field-checkbox-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <label
      htmlFor={checkboxId}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-1 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/40",
        className,
      )}
    >
      <Checkbox
        id={checkboxId}
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
