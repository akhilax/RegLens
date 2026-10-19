export type DiffPart = { text: string; type: "same" | "add" | "del" };

/** Word-level LCS diff (sections are short, so O(n·m) is fine). */
export function diffWords(a: string, b: string): { left: DiffPart[]; right: DiffPart[] } {
  const x = a.split(/(\s+)/);
  const y = b.split(/(\s+)/);
  const n = x.length;
  const m = y.length;
  const dp: Uint16Array[] = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = x[i] === y[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const left: DiffPart[] = [];
  const right: DiffPart[] = [];
  const push = (arr: DiffPart[], text: string, type: DiffPart["type"]) => {
    const last = arr[arr.length - 1];
    if (last && last.type === type) last.text += text;
    else arr.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push(left, x[i], "same");
      push(right, y[j], "same");
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) push(left, x[i++], "del");
    else push(right, y[j++], "add");
  }
  while (i < n) push(left, x[i++], "del");
  while (j < m) push(right, y[j++], "add");
  return { left, right };
}
