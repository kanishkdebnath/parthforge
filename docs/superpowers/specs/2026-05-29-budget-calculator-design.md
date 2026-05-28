# Budget Amount Calculator — Design

**Date:** 2026-05-29
**Status:** Spec
**Scope:** Frontend-only enhancement to the Budget feature

## Motivation

Setting a transaction amount today requires the user to do any math in their head (or in another app) and type a single number. Common real-world flows — splitting a bill, adding tax/tip, applying a percentage of salary as a target — would be smoother if the amount input itself could evaluate a small expression.

This spec adds a calculator popover next to every amount field in the Budget feature, supporting full arithmetic expressions including parentheses.

## Goals

- One reusable component (`BudgetAmountInput`) replaces the bare `<Input>` used for amounts in all four budget forms.
- Calculator opens as a popover from a small icon inside the amount field. The amount field still accepts a plain typed number — calculator is opt-in.
- Popover supports both typed expressions (keyboard) and a tap pad (operators + digits + parens).
- Expressions support `+`, `−`, `×`, `÷`, parentheses, decimals, and unary `±`.
- No `eval()`, no `new Function()`, no library dependency for the parser.
- No backend changes. The API still receives a single integer in minor units, exactly as today.

## Non-Goals

- Multi-currency conversion inside expressions (e.g. `100 USD + 50 EUR`).
- Calculator memory (`M+`, `MR`), history of past expressions.
- Auto-evaluating expressions typed directly into the bare amount field (must go through the popover).
- Variables, named constants, scientific functions.

## UX

### Trigger

A `Calculator` lucide icon is rendered as a ghost button absolutely-positioned inside the right padding of the amount input. Right padding on the amount input increases by ~32px to make room. The icon button:

- `aria-label="Open calculator"`
- Clicking opens the popover.
- The bare amount input continues to work for users who just want to type a number — the calculator is purely additive.

### Popover layout (~280px wide)

```
┌─────────────────────────────────────┐
│  [ 1200 + 450 * 1.18              ] │  ← editable expression box (autofocus)
│  = ₹1,731                           │  ← live preview (currency symbol from form)
├─────────────────────────────────────┤
│  [ 7 ][ 8 ][ 9 ][ ÷ ][ ( ]          │
│  [ 4 ][ 5 ][ 6 ][ × ][ ) ]          │
│  [ 1 ][ 2 ][ 3 ][ − ][ ⌫ ]          │
│  [ 0 ][ . ][ 00][ + ][ C ]          │
├─────────────────────────────────────┤
│              [ Cancel ]   [ Use ]    │
└─────────────────────────────────────┘
```

### State and behavior

- **Opening:** the expression box is pre-filled with the current amount field value if non-empty, otherwise blank. Cursor at end, content selected so the next keystroke replaces it.
- **Editing:** typing in the expression box and tapping pad buttons both modify the same expression string. Pad buttons insert at the current caret position (not just append to the end). `⌫` deletes one character to the left of the caret; `C` clears the expression entirely.
- **Live preview:** every change re-evaluates the expression and updates the preview:
  - Valid result: `= ₹1,731` (currency symbol matches the form's currency)
  - Incomplete (e.g. ends in operator or open paren, or empty): `…` (no error chrome)
  - Invalid (complete-looking input that fails to parse, e.g. `1++2`, division by zero): subtle red `Invalid expression`
- **Commit:**
  - **Use button** → writes the rounded result back into the amount field via the wrapper's `onChange`, closes the popover, returns focus to the amount input.
  - **Enter key** (inside expression box) → same as Use, but only fires when the expression is valid.
  - **Cancel / Esc / outside-click** → closes without writing.
  - Use button is disabled while the expression is invalid or empty. Zero is allowed at popover commit time; the parent form's existing positive-amount validation rejects it on submit (matches current behavior for typed `0`).
- **Result rounding:** the float result is rounded to currency precision at commit time, reusing the existing subunit rule from `apps/web/src/lib/budget-formatting.ts` (currently `currency === 'JPY'` is subunit-less; everything else uses two-decimal minor units):
  - Subunit currencies: `formatMinorForInput(Math.round(result * 100))`
  - Subunit-less currencies: `String(Math.round(result))`
  The evaluator itself is currency-agnostic; only the wrapper component does the rounding. If new subunit-less currencies are added later, updating the existing helper updates the calculator automatically.

### Accessibility

- Popover traps focus while open, restores focus to the amount input on close.
- Expression box has an adjacent `aria-live="polite"` region that announces the result (or "invalid expression") on change.
- All pad buttons are real `<button type="button">` with `aria-label` (e.g. `aria-label="multiply"`).
- Calculator icon button has `aria-label="Open calculator"`.

## Component Architecture

Two new components and one new utility module:

```
apps/web/src/components/budget/
├── BudgetAmountInput.tsx          (new — wraps Input + adds calculator trigger/popover)
└── BudgetCalculatorPopover.tsx    (new — popover panel: expression box + pad + actions)

apps/web/src/lib/
└── budget-expression.ts           (new — safe expression evaluator)
```

### `BudgetAmountInput` props

Drop-in replacement for the current `<Input>` usage. Exposes the same props each call site uses today, plus a required `currency` prop for the preview:

```ts
interface BudgetAmountInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  currency: string;
  // ref is forwarded to the underlying <Input>
}
```

The popover, expression state, and commit logic are all internal — none of the four call sites learn about them.

### `BudgetCalculatorPopover` props

```ts
interface BudgetCalculatorPopoverProps {
  open: boolean;
  initialExpression: string;
  currency: string;
  onCommit: (majorString: string) => void;  // already rounded to currency precision
  onCancel: () => void;
  triggerRef: React.RefObject<HTMLElement>;
}
```

## Expression Evaluator

A pure function in `apps/web/src/lib/budget-expression.ts`:

```ts
export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'incomplete' | 'invalid' };

export function evaluateExpression(input: string): EvalResult;
```

### Grammar (recursive-descent, left-associative)

```
expr   = term (('+' | '-') term)*
term   = factor (('*' | '/' | '×' | '÷') factor)*
factor = number | '(' expr ')' | ('-' | '+') factor       // unary +/−
number = digit+ ('.' digit+)?
```

- Whitespace allowed between tokens.
- Operator aliases: `×` → `*`, `÷` → `/`, `−` (Unicode minus U+2212) → `-`. This lets pad buttons render typographically-correct glyphs while still parsing when echoed back into the expression box.

### Error semantics

The popover distinguishes two failure modes:

- **`incomplete`** — expression ends in an operator or open paren, or is empty. Popover shows `…` with no error styling. This is the "user is mid-typing" state.
- **`invalid`** — parse error on a complete-looking input (e.g. `1++2`, `1+(2`, `1 2`, unknown character, division by zero). Popover shows subtle red `Invalid expression`.

The parser flags `incomplete` by tracking whether the last consumed token was an operator or open-paren when EOF is reached. Everything else that doesn't parse is `invalid`.

### Safety

- No `eval`, no `new Function`, no library dependency.
- Tokenizer accepts only digits, `.`, the operator set (`+ - × ÷ * / −`), parens, and whitespace. Anything else is `invalid`.
- Input is hard-capped at 100 characters to bound parse work.

### Division-by-zero

Treated as `invalid` (not `Infinity` or `NaN` silently flowing through).

### Numerical precision

The evaluator works in plain JS doubles and is currency-agnostic. Final rounding to currency minor units happens at commit time in `BudgetAmountInput`, not inside the evaluator.

## Integration

Call-site changes are mechanical — each form swaps `<Input>` for `<BudgetAmountInput>` and passes the budget `currency`:

- [BudgetInputRow.tsx:151-159](apps/web/src/components/budget/BudgetInputRow.tsx#L151-L159) — used on the main Budget page and in the dashboard quick-add modal (same component, two surfaces, single change).
- `BudgetEditTransactionDialog.tsx` — edit-transaction amount.
- `BudgetTargetsForm.tsx` — per-category target amount on the Plan page.
- `BudgetRecurringFormDialog.tsx` — recurring transaction amount.

All four already have `currency` in scope from the user's budget settings.

## Testing

Unit tests in `apps/web/src/lib/__tests__/budget-expression.test.ts`:

- Precedence: `2 + 3 * 4 === 14`, `(2 + 3) * 4 === 20`
- Parens: nested, leading paren, mismatched paren is invalid
- Unary: `-5`, `+5`, `-(2+3)`, `--5` (double-negate)
- Operator aliases: `×`, `÷`, `−` produce same results as `*`, `/`, `-`
- Whitespace tolerance: `1 + 2`, `1+2`, ` 1 + 2 ` all parse identically
- Incomplete states: ``, `1+`, `(`, `1+(2+`
- Invalid states: `1++2`, `1**2`, `1/0`, `abc`, `1.2.3`, `(1+2`
- Division-by-zero is invalid
- Max-length guard (101 chars is invalid)
- Realistic budget expressions: `120+80*0.18`, `(1200-300)/2`, `1000*0.3`, `2500*1.05`

Component tests for `BudgetAmountInput` (Vitest + Testing Library):

- Renders as a drop-in for the existing `<Input>` (same value/onChange contract).
- Calculator icon opens the popover; popover closes on outside click and Esc.
- Pre-fills expression box with current value.
- Use button writes the rounded result back via `onChange` and closes the popover.
- Cancel does not write.
- Use is disabled when expression is invalid.
- Cent-currency rounding: `100/3` commits as `33.33`.
- JPY rounding: `100/3` commits as `33`.

## Out of Scope

- Multi-currency expressions / FX conversion.
- Memory keys, history.
- Inline expression evaluation in the bare amount field (must use popover).
- Backend changes — none required.
