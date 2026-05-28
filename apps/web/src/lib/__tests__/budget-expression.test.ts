import { describe, expect, it } from 'vitest';
import { evaluateExpression } from '../budget-expression';

function expectValue(input: string, value: number) {
  const r = evaluateExpression(input);
  if (!r.ok) throw new Error(`expected ok, got ${r.reason}`);
  expect(r.value).toBeCloseTo(value, 10);
}

function expectIncomplete(input: string) {
  const r = evaluateExpression(input);
  expect(r).toEqual({ ok: false, reason: 'incomplete' });
}

function expectInvalid(input: string) {
  const r = evaluateExpression(input);
  expect(r).toEqual({ ok: false, reason: 'invalid' });
}

describe('evaluateExpression — basic arithmetic', () => {
  it('adds, subtracts, multiplies, divides', () => {
    expectValue('1+2', 3);
    expectValue('10-3', 7);
    expectValue('6*7', 42);
    expectValue('20/4', 5);
  });

  it('honors operator precedence', () => {
    expectValue('2+3*4', 14);
    expectValue('2*3+4', 10);
    expectValue('10-2*3', 4);
  });

  it('is left-associative', () => {
    expectValue('10-3-2', 5);
    expectValue('20/2/2', 5);
  });
});

describe('evaluateExpression — parens', () => {
  it('overrides precedence', () => {
    expectValue('(2+3)*4', 20);
    expectValue('2*(3+4)', 14);
  });

  it('nests', () => {
    expectValue('((1+2)*(3+4))', 21);
    expectValue('(1+(2*(3+4)))', 15);
  });
});

describe('evaluateExpression — unary', () => {
  it('handles leading minus and plus', () => {
    expectValue('-5', -5);
    expectValue('+5', 5);
    expectValue('-(2+3)', -5);
  });

  it('handles double negate', () => {
    expectValue('--5', 5);
  });

  it('handles unary after operator', () => {
    expectValue('10+-3', 7);
    expectValue('10*-2', -20);
  });
});

describe('evaluateExpression — operator aliases', () => {
  it('treats × as * and ÷ as /', () => {
    expectValue('6×7', 42);
    expectValue('20÷4', 5);
  });

  it('treats Unicode minus as -', () => {
    expectValue('10−3', 7);
  });
});

describe('evaluateExpression — whitespace', () => {
  it('tolerates spaces between tokens', () => {
    expectValue('1 + 2', 3);
    expectValue(' 1 + 2 ', 3);
    expectValue('(  1  +  2  )  *  3', 9);
  });
});

describe('evaluateExpression — decimals', () => {
  it('parses decimal numbers', () => {
    expectValue('0.5+0.25', 0.75);
    expectValue('120+80*0.18', 134.4);
  });

  it('rejects multiple decimal points in one number', () => {
    expectInvalid('1.2.3');
  });
});

describe('evaluateExpression — incomplete states', () => {
  it('empty input is incomplete', () => {
    expectIncomplete('');
    expectIncomplete('   ');
  });

  it('trailing operator is incomplete', () => {
    expectIncomplete('1+');
    expectIncomplete('1*');
    expectIncomplete('1-');
    expectIncomplete('1/');
  });

  it('open paren without matching close is incomplete when EOF after operator/open', () => {
    expectIncomplete('(');
    expectIncomplete('(1+');
    expectIncomplete('(1+(2+');
  });
});

describe('evaluateExpression — invalid states', () => {
  it('rejects double operators', () => {
    expectInvalid('1**2');
    expectInvalid('1//2');
  });

  it('rejects unknown characters', () => {
    expectInvalid('abc');
    expectInvalid('1+a');
    expectInvalid('1$2');
  });

  it('rejects unmatched closing paren', () => {
    expectInvalid('1+2)');
    expectInvalid(')');
  });

  it('rejects unmatched opening paren on otherwise complete input', () => {
    expectInvalid('(1+2');
  });

  it('rejects empty parens', () => {
    expectInvalid('()');
  });

  it('rejects division by zero', () => {
    expectInvalid('1/0');
    expectInvalid('5/(2-2)');
  });

  it('rejects two numbers with only whitespace between', () => {
    expectInvalid('1 2');
  });

  it('rejects input over 100 chars', () => {
    const long = '1+'.repeat(60) + '1';
    expectInvalid(long);
  });
});

describe('evaluateExpression — realistic budget expressions', () => {
  it('handles tax/tip patterns', () => {
    expectValue('120+80*0.18', 134.4);
    expectValue('(120+80)*1.18', 236);
  });

  it('handles splits', () => {
    expectValue('(1200-300)/2', 450);
    expectValue('2500/4', 625);
  });

  it('handles percentage-of-salary targets', () => {
    expectValue('50000*0.3', 15000);
  });
});
