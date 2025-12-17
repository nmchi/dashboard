import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseFormRegister, Path } from "react-hook-form";
import { PlayerFormValues } from "./player-dialog";

interface SettingInputProps {
    label?: string;
    name: Path<PlayerFormValues>; 
    register: UseFormRegister<PlayerFormValues>;
    placeholder?: string;
}

export function SettingInput({ label, name, register, placeholder }: SettingInputProps) {
    return (
        <div className="space-y-1">
            {label && <Label className="text-xs text-slate-500">{label}</Label>}
            <div className="relative">
                <Input 
                {...register(name, { valueAsNumber: true })} 
                type="number" 
                step="0.01"
                className="h-8 text-sm pr-1 text-right font-mono"
                placeholder={placeholder}
                />
            </div>
        </div>
    )
}