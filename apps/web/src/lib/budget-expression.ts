/**
 * Safe arithmetic expression evaluator for the budget calculator popover.
 *
 * Grammar (recursive-descent, left-associative):
 *   expr   = term (('+' | '-') term)*
 *   term   = factor (('*' | '/' | '×' | '÷') factor)*
 *   factor = number | '(' expr ')' | ('-' | '+') factor
 *   number = digit+ ('.' digit+)?
 *
 * No eval, no new Function. Tokenizer rejects anything outside the allowed
 * character set, so untrusted input cannot reach a JS runtime.
 */

export type EvalResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'incomplete' | 'invalid' };

const MAX_INPUT_LENGTH = 100;

type TokenKind =
  | 'number'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'lparen'
  | 'rparen';

interface Token {
  kind: TokenKind;
  value?: number;
}

type TokenizeResult =
  | { ok: true; tokens: Token[] }
  | { ok: false; reason: 'invalid' };

function tokenize(input: string): TokenizeResult {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i] as string;

    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    if (ch === '+') {
      tokens.push({ kind: 'plus' });
      i++;
      continue;
    }
    if (ch === '-' || ch === '−') {
      tokens.push({ kind: 'minus' });
      i++;
      continue;
    }
    if (ch === '*' || ch === '×') {
      tokens.push({ kind: 'star' });
      i++;
      continue;
    }
    if (ch === '/' || ch === '÷') {
      tokens.push({ kind: 'slash' });
      i++;
      continue;
    }
    if (ch === '(') {
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }
    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }

    if (isDigit(ch) || ch === '.') {
      const start = i;
      let sawDot = ch === '.';
      i++;
      while (i < input.length) {
        const c = input[i] as string;
        if (isDigit(c)) {
          i++;
          continue;
        }
        if (c === '.' && !sawDot) {
          sawDot = true;
          i++;
          continue;
        }
        break;
      }
      const slice = input.slice(start, i);
      // Reject bare "." (no digits at all).
      if (slice === '.' || slice === '') {
        return { ok: false, reason: 'invalid' };
      }
      const n = Number(slice);
      if (!Number.isFinite(n)) {
        return { ok: false, reason: 'invalid' };
      }
      tokens.push({ kind: 'number', value: n });
      continue;
    }

    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, tokens };
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

class ParseError {
  constructor(public reason: 'incomplete' | 'invalid') {}
}

interface ParserState {
  tokens: Token[];
  pos: number;
}

function peek(s: ParserState): Token | undefined {
  return s.tokens[s.pos];
}

function consume(s: ParserState): Token {
  const t = s.tokens[s.pos] as Token;
  s.pos++;
  return t;
}

function parseExpr(s: ParserState): number {
  let left = parseTerm(s);
  while (true) {
    const t = peek(s);
    if (!t) break;
    if (t.kind === 'plus' || t.kind === 'minus') {
      consume(s);
      const right = parseTerm(s);
      left = t.kind === 'plus' ? left + right : left - right;
      continue;
    }
    break;
  }
  return left;
}

function parseTerm(s: ParserState): number {
  let left = parseFactor(s);
  while (true) {
    const t = peek(s);
    if (!t) break;
    if (t.kind === 'star' || t.kind === 'slash') {
      consume(s);
      const right = parseFactor(s);
      if (t.kind === 'slash') {
        if (right === 0) throw new ParseError('invalid');
        left = left / right;
      } else {
        left = left * right;
      }
      continue;
    }
    break;
  }
  return left;
}

function parseFactor(s: ParserState): number {
  const t = peek(s);
  if (!t) throw new ParseError('incomplete');

  if (t.kind === 'plus') {
    consume(s);
    return parseFactor(s);
  }
  if (t.kind === 'minus') {
    consume(s);
    return -parseFactor(s);
  }
  if (t.kind === 'lparen') {
    consume(s);
    // Empty parens are invalid (not incomplete) — there's no operand.
    const next = peek(s);
    if (next && next.kind === 'rparen') throw new ParseError('invalid');
    const value = parseExpr(s);
    const close = peek(s);
    // Missing rparen at EOF is "invalid" not "incomplete": the last consumed
    // token was a number/rparen, so the user isn't mid-operator — they've
    // typed a complete-looking but mismatched expression.
    if (!close || close.kind !== 'rparen') throw new ParseError('invalid');
    consume(s);
    return value;
  }
  if (t.kind === 'number') {
    consume(s);
    return t.value as number;
  }
  // Unexpected token (operator at factor position, stray rparen, etc.)
  throw new ParseError('invalid');
}

export function evaluateExpression(input: string): EvalResult {
  if (input.length > MAX_INPUT_LENGTH) {
    return { ok: false, reason: 'invalid' };
  }
  const tokenized = tokenize(input);
  if (!tokenized.ok) return { ok: false, reason: 'invalid' };
  if (tokenized.tokens.length === 0) {
    return { ok: false, reason: 'incomplete' };
  }
  const state: ParserState = { tokens: tokenized.tokens, pos: 0 };
  let value: number;
  try {
    value = parseExpr(state);
  } catch (e) {
    if (e instanceof ParseError) {
      return { ok: false, reason: e.reason };
    }
    throw e;
  }
  if (state.pos !== state.tokens.length) {
    // Leftover tokens — e.g. "1+2)" or "1 2".
    return { ok: false, reason: 'invalid' };
  }
  if (!Number.isFinite(value)) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, value };
}
