import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/budget', label: 'Log', end: true },
  { to: '/budget/plan', label: 'Plan' },
  { to: '/budget/report', label: 'Report' },
  { to: '/budget/categories', label: 'Categories' },
  { to: '/budget/recurring', label: 'Recurring' },
  { to: '/budget/settings', label: 'Settings' },
] as const;

/**
 * Sub-navigation for every /budget/* route. NavLink's `end` prop on the
 * /budget tab ensures it only highlights for the exact base path, not for
 * /budget/plan etc.
 */
export function BudgetTabStrip() {
  return (
    <nav className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-6">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={'end' in tab ? tab.end : false}
          className={({ isActive }) =>
            `px-3 py-2 text-sm transition-colors border-b-2 -mb-px ${
              isActive
                ? 'border-sky-500 text-slate-900 dark:text-slate-100'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
