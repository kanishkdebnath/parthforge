import { COMMON_CURRENCIES } from '@pathforge/shared';
import { useMe, useUpdateMe } from '@/hooks/useAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Currency picker driven by /api/auth/me. The User shape exposes `currency`
 * as optional in the Zod schema, but the server always echoes 'INR' for
 * legacy users — so the local fallback below mirrors that.
 */
export function BudgetCurrencySelector() {
  const { data: me } = useMe();
  const updateMe = useUpdateMe();

  const current = me?.currency ?? 'INR';

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 max-w-md">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">
        Currency
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        The currency symbol and digit grouping used everywhere in Budget.
        Changing this does not convert any existing amounts.
      </p>
      <Select
        value={current}
        onValueChange={(value) => {
          if (value === current) return;
          updateMe.mutate({ currency: value });
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMMON_CURRENCIES.map((code) => (
            <SelectItem key={code} value={code}>
              {code}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
