import { useToastStore } from "@/store/toastStore";

export function useToast() {
  return useToastStore((s) => s.avisar);
}
