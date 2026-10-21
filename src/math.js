'use strict';
// Arithmetic without eval() or remote code execution; supports + - * / % ^ parentheses.
function calculate(input) {
  if (!input || input.length > 150) throw new Error('Expression must be 1–150 characters');
  const chars = input.replace(/\s+/g, '');
  if (!/^[0-9.+\-*/%^()]+$/.test(chars)) throw new Error('Only numbers and + - * / % ^ ( ) supported');
  const tokens = chars.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%^]/g) || [];
  if (tokens.join('') !== chars) throw new Error('Bad token');
  let i = 0;
  const prec = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 4 };
  function primary() {
    const current = tokens[i++];
    if (current === '+' || current === '-') return (current === '-' ? -1 : 1) * expression(3);
    if (current === '(') {
      const result = expression(0);
      if (tokens[i++] !== ')') throw new Error('Unclosed parenthesis');
      return result;
    }
    if (!current || !/^\d*\.?\d+$/.test(current)) throw new Error('Expected number');
    return Number(current);
  }
  function expression(min) {
    let lhs = primary();
    while (i < tokens.length && Object.hasOwn(prec, tokens[i]) && prec[tokens[i]] >= min) {
      const op = tokens[i++], p = prec[op];
      const rhs = expression(op === '^' ? p : p + 1);
      if (op === '+') lhs += rhs;
      if (op === '-') lhs -= rhs;
      if (op === '*') lhs *= rhs;
      if (op === '/') lhs /= rhs;
      if (op === '%') lhs %= rhs;
      if (op === '^') lhs **= rhs;
      if (!Number.isFinite(lhs) || Math.abs(lhs) > 1e15) throw new Error('Result is out of range');
    }
    return lhs;
  }
  const n = expression(0);
  if (i !== tokens.length) throw new Error('Unexpected token');
  if (!Number.isFinite(n)) throw new Error('Non-finite result');
  return Math.round((n + Number.EPSILON) * 1e10) / 1e10;
}
module.exports = { calculate };
