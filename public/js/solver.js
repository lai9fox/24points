/* global */

const OPS = ["+", "-", "*", "/"];

function calcOp(a, b, op) {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case "/": return b !== 0 ? a / b : null;
  }
}

function isClose(val, target) {
  return Math.abs(val - target) < 1e-9;
}

function canMake24(nums) {
  if (nums.length === 1) return isClose(nums[0], 24);
  for (let i = 0; i < nums.length; i++) {
    for (let j = 0; j < nums.length; j++) {
      if (i === j) continue;
      const rest = nums.filter((_, k) => k !== i && k !== j);
      for (const op of OPS) {
        const result = calcOp(nums[i], nums[j], op);
        if (result === null) continue;
        if (!Number.isInteger(result)) continue;
        if (canMake24([result, ...rest])) return true;
      }
    }
  }
  return false;
}

function findSolution(cards) {
  return solve(cards.map((c) => ({ val: c, expr: String(c) })));
}

function solve(exprs) {
  if (exprs.length === 1) {
    return isClose(exprs[0].val, 24) ? exprs[0].expr : null;
  }
  for (let i = 0; i < exprs.length; i++) {
    for (let j = 0; j < exprs.length; j++) {
      if (i === j) continue;
      const rest = exprs.filter((_, k) => k !== i && k !== j);
      const a = exprs[i];
      const b = exprs[j];
      for (const op of OPS) {
        const val = calcOp(a.val, b.val, op);
        if (val === null) continue;
        if (!Number.isInteger(val)) continue;
        const needParenA =
          (op === "*" || op === "/") &&
          (a.expr.includes("+") || a.expr.includes("-")) &&
          a.expr.length > 1;
        const needParenB =
          (op === "*" || op === "/" || op === "-") &&
          (b.expr.includes("+") || b.expr.includes("-")) &&
          b.expr.length > 1;
        const exprA = needParenA ? `(${a.expr})` : a.expr;
        const exprB = needParenB ? `(${b.expr})` : b.expr;
        const combined = { val, expr: `${exprA} ${op} ${exprB}` };
        const result = solve([combined, ...rest]);
        if (result) return result;
      }
    }
  }
  return null;
}

function tokenize(cleaned) {
  const tokens = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i];
    if (ch >= "0" && ch <= "9") {
      let num = "";
      while (i < cleaned.length && cleaned[i] >= "0" && cleaned[i] <= "9") {
        num += cleaned[i++];
      }
      tokens.push({ type: "num", value: Number(num) });
    } else if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", value: ch });
      i++;
    } else if (ch === "(") {
      tokens.push({ type: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ type: "rparen" });
      i++;
    } else {
      i++;
    }
  }
  return tokens;
}

function evalTokens(tokens) {
  let pos = 0;

  function parseExpr() {
    let left = parseTerm();
    while (pos < tokens.length && tokens[pos].type === "op" && (tokens[pos].value === "+" || tokens[pos].value === "-")) {
      const op = tokens[pos++].value;
      const right = parseTerm();
      if (left === null || right === null) return null;
      left = calcOp(left, right, op);
      if (left === null || !Number.isInteger(left)) return null;
    }
    return left;
  }

  function parseTerm() {
    let left = parseFactor();
    while (pos < tokens.length && tokens[pos].type === "op" && (tokens[pos].value === "*" || tokens[pos].value === "/")) {
      const op = tokens[pos++].value;
      const right = parseFactor();
      if (left === null || right === null) return null;
      left = calcOp(left, right, op);
      if (left === null || !Number.isInteger(left)) return null;
    }
    return left;
  }

  function parseFactor() {
    if (pos >= tokens.length) return null;
    const tok = tokens[pos];
    if (tok.type === "lparen") {
      pos++;
      const val = parseExpr();
      if (pos < tokens.length && tokens[pos].type === "rparen") pos++;
      return val;
    }
    if (tok.type === "num") {
      pos++;
      return tok.value;
    }
    return null;
  }

  const result = parseExpr();
  if (pos !== tokens.length) return null;
  return result;
}

function validateExpression(expr, cards) {
  const cleaned = expr.replace(/\s/g, "");
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) {
    return { valid: false, error: "包含非法字符" };
  }
  const numbersInExpr = cleaned.match(/\d+/g);
  if (!numbersInExpr) {
    return { valid: false, error: "没有找到数字" };
  }
  const usedNums = numbersInExpr.map(Number);
  const sortedUsed = [...usedNums].sort((a, b) => a - b);
  const sortedCards = [...cards].sort((a, b) => a - b);
  if (sortedUsed.length !== sortedCards.length) {
    return { valid: false, error: "必须恰好使用 4 个数字各一次" };
  }
  for (let i = 0; i < sortedUsed.length; i++) {
    if (sortedUsed[i] !== sortedCards[i]) {
      return { valid: false, error: "使用的数字与给定的牌不匹配" };
    }
  }
  if (/[0-9]\s*\(/.test(cleaned) || /\)\s*[0-9]/.test(cleaned)) {
    return { valid: false, error: "隐式乘法不被允许" };
  }
  try {
    const tokens = tokenize(cleaned);
    const result = evalTokens(tokens);
    if (result === null) {
      return { valid: false, error: "计算过程中出现了小数，中间值必须为整数" };
    }
    if (typeof result !== "number" || !isFinite(result)) {
      return { valid: false, error: "表达式计算错误" };
    }
    if (!isClose(result, 24)) {
      return { valid: false, error: `结果为 ${result}，不等于 24` };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "表达式格式错误" };
  }
}

function generatePuzzle() {
  const cards = Array.from({ length: 4 }, () => Math.floor(Math.random() * 13) + 1);
  const solvable = canMake24(cards);
  return { cards, solvable };
}

window.Solver = { canMake24, findSolution, validateExpression, generatePuzzle };
