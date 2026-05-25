import { useEffect, useMemo, useState } from 'react';
import type {
  BudgetCategoryGroup,
  BudgetCategory,
  BudgetTarget,
} from '@pathforge/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useBudgetTargets,
  useBulkUpsertTargets,
} from '@/hooks/useBudget';
import { addMonths } from '@/lib/budget-month';
import {
  parseMajorToMinor,
  formatMinorForInput,
  getCurrencySymbol,
} from '@/lib/budget-formatting';

interface Props {
  month: string;
  groups: BudgetCategoryGroup[];
  categories: BudgetCategory[];
  currency: string;
}

/**
 * Map of categoryId → string the user has typed (major units). Stored as
 * strings so partial edits ("12" while typing "1200") don't get coerced
 * back to numbers mid-keypress.
 */
type DraftMap = Record<string, string>;

export function BudgetTargetsForm({ month, groups, categories, currency }: Props) {
  const { data: targets = [], isPending } = useBudgetTargets(month);
  const { data: prevTargets = [] } = useBudgetTargets(addMonths(month, -1));
  const upsert = useBulkUpsertTargets();

  const targetsByCategory = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    for (const t of targets) map.set(t.categoryId, t);
    return map;
  }, [targets]);

  const prevByCategory = useMemo(() => {
    const map = new Map<string, BudgetTarget>();
    for (const t of prevTargets) map.set(t.categoryId, t);
    return map;
  }, [prevTargets]);

  // Live categories grouped by group.
  const liveCategories = useMemo(
    () => categories.filter((c) => !c.archived),
    [categories]
  );

  const [draft, setDraft] = useState<DraftMap>({});
  const [bannerKind, setBannerKind] =
    useState<'pre-filled' | 'first-ever' | 'none'>('none');

  // Initialize draft when targets data arrives or month changes.
  useEffect(() => {
    if (isPending) return;
    const next: DraftMap = {};
    if (targetsByCategory.size > 0) {
      // Existing targets — fill from them; banner off.
      for (const c of liveCategories) {
        const existing = targetsByCategory.get(c._id);
        next[c._id] = existing ? formatMinorForInput(existing.amount) : '';
      }
      setBannerKind('none');
    } else if (prevByCategory.size > 0) {
      // Carry-forward from previous month.
      for (const c of liveCategories) {
        const prev = prevByCategory.get(c._id);
        next[c._id] = prev ? formatMinorForInput(prev.amount) : '';
      }
      setBannerKind('pre-filled');
    } else {
      // First-ever use.
      for (const c of liveCategories) {
        next[c._id] = '';
      }
      setBannerKind('first-ever');
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isPending, targetsByCategory, prevByCategory, liveCategories.length]);

  const dirty = useMemo(() => {
    // Dirty if any draft amount differs from the persisted target for that
    // category. Empty string is treated as "no target" — dirty only if there
    // was a target before.
    for (const c of liveCategories) {
      const d = draft[c._id] ?? '';
      const existing = targetsByCategory.get(c._id);
      if (d.trim() === '') {
        if (existing) return true;
        continue;
      }
      const minor = parseMajorToMinor(d);
      if (minor === null) return true;
      if (!existing || existing.amount !== minor) return true;
    }
    return false;
  }, [draft, liveCategories, targetsByCategory]);

  async function onSave() {
    const items: Array<{ categoryId: string; amount: number }> = [];
    for (const c of liveCategories) {
      const d = draft[c._id] ?? '';
      if (d.trim() === '') continue;
      const minor = parseMajorToMinor(d);
      if (minor === null) continue;
      items.push({ categoryId: c._id, amount: minor });
    }
    await upsert.mutateAsync({ month, items });
  }

  if (isPending) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {bannerKind === 'pre-filled' && (
        <div className="rounded-md border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          These are last month's numbers — confirm or adjust, then Save.
        </div>
      )}
      {bannerKind === 'first-ever' && (
        <div className="rounded-md border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-900 dark:text-sky-200">
          Set your first monthly targets — they're soft anchors, not hard limits.
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g) => {
          const inGroup = liveCategories
            .filter((c) => c.groupId === g._id)
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          if (inGroup.length === 0) return null;
          return (
            <div
              key={g._id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
            >
              <div className="flex items-center gap-2 mb-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: g.color }}
                />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {g.name}
                </h3>
              </div>
              <div className="space-y-2">
                {inGroup.map((c) => (
                  <div key={c._id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-800 dark:text-slate-200">
                      {c.name}
                    </span>
                    <div className="flex items-center gap-1.5 w-44">
                      <span className="text-xs text-slate-500">{getCurrencySymbol(currency)}</span>
                      <Input
                        value={draft[c._id] ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [c._id]: e.target.value }))
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className="text-right tabular-nums"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={!dirty || upsert.isPending}>
          {upsert.isPending ? 'Saving…' : 'Save targets'}
        </Button>
      </div>
    </div>
  );
}
