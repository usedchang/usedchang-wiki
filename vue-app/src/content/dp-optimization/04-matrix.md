## 4. 矩阵快速幂 & 倍增优化 DP

### 4.1 核心思想

当 DP 的**阶段数 $T$ 极大**（如 $10^{18}$），但**每阶段转移规则完全相同且只依赖固定数量的前序状态**时，将转移写成矩阵乘法，用快速幂 $O(d^3 \log T)$ 跳阶段。

---

### 4.2 线性递推 → 矩阵形式

**例 — Fibonacci**：

```cpp
F[n]   = F[n-1] + F[n-2]
F[n-1] = F[n-1]
```

写成矩阵：

$$
\begin{bmatrix} F[n] \\ F[n-1] \end{bmatrix}
=
\begin{bmatrix} 1 & 1 \\ 1 & 0 \end{bmatrix}
\begin{bmatrix} F[n-1] \\ F[n-2] \end{bmatrix}
$$

---

### 4.3 矩阵快速幂模板

```cpp
using Matrix = vector<vector<long long>>;

Matrix mul(const Matrix& A, const Matrix& B, int mod) {
    int n = A.size(), m = B[0].size(), p = B.size();
    Matrix C(n, vector<long long>(m, 0));
    for (int i = 0; i < n; i++)
        for (int k = 0; k < p; k++) {
            if (A[i][k] == 0) continue;
            for (int j = 0; j < m; j++)
                C[i][j] = (C[i][j] + A[i][k] * B[k][j]) % mod;
        }
    return C;
}

Matrix power(Matrix A, long long k, int mod) {
    int n = A.size();
    Matrix res(n, vector<long long>(n, 0));
    for (int i = 0; i < n; i++) res[i][i] = 1;
    while (k) {
        if (k & 1) res = mul(res, A, mod);
        A = mul(A, A, mod);
        k >>= 1;
    }
    return res;
}
```

> 优化：`if (A[i][k] == 0) continue;` 利用稀疏性，实测快 2~10 倍。

---

### 4.4 图上定长路径计数

有向图邻接矩阵 $G$，求 $u \to v$ 恰好走 $k$ 步的路径数：$ans = (G^k)[u][v]$。

---

### 4.5 倍增优化 (Binary Lifting)

与矩阵快速幂等价，写法更直观。适合「步数很大」的 DP。

```cpp
// nxt[t][i] = 从 i 走 2^t 步到达的位置
for (int t = 1; t < LOG; t++)
    for (int i = 1; i <= n; i++)
        nxt[t][i] = nxt[t - 1][nxt[t - 1][i]];

int cur = start;
for (int t = 0; t < LOG; t++)
    if (k & (1LL << t))
        cur = nxt[t][cur];
```

---

### 4.6 自动机上的 DP

AC 自动机 / 数位 DP：状态数有限（$\le 2000$），转移用矩阵快速幂处理极大长度。

```
给定禁止串集合，求长度为 L 的不含任何禁止串的字符串个数。
1. 建 AC 自动机
2. 建转移矩阵 M: M[i][j] = 从状态 i 到 j 的合法字符数
3. ans = (M^L)[root][*] 的和
```

---

### 4.7 例题：[Field Watering Plan](https://atcoder.jp/contests/awc0021/tasks/awc0021_e?lang=en)

连续 $N$ 天浇水，每天选方法 A 或 B。若前一天选了 A，当天成长量减半（基于基础值 $a/b$，不连锁折半）。

$$
\begin{aligned}
\mathrm{dp}_A[i] &= \max\bigl(\mathrm{dp}_A[i-1] + \lfloor a/2 \rfloor,\ \mathrm{dp}_B[i-1] + a\bigr) \\
\mathrm{dp}_B[i] &= \max\bigl(\mathrm{dp}_A[i-1] + \lfloor b/2 \rfloor,\ \mathrm{dp}_B[i-1] + b\bigr)
\end{aligned}
$$

写成 $2 \times 2$ 转移矩阵，矩阵快速幂 $O(\log N)$：

```cpp
#include <iostream>
#include <array>
#include <algorithm>
using namespace std;

int main() {
    long N, a, b;
    cin >> N >> a >> b;
    const auto prod{[](const array<long, 4>& lhs, const array<long, 4>& rhs) {
        return array<long, 4>{{
            max(lhs[0] + rhs[0], lhs[1] + rhs[2]),
            max(lhs[0] + rhs[1], lhs[1] + rhs[3]),
            max(lhs[2] + rhs[0], lhs[3] + rhs[2]),
            max(lhs[2] + rhs[1], lhs[3] + rhs[3])
        }};
    }};
    array<long, 4> ans{{a / 2, b / 2, a, b}}, coef{ans};
    --N;
    while (N) {
        if (N & 1) ans = prod(ans, coef);
        coef = prod(coef, coef);
        N /= 2;
    }
    cout << ranges::max(ans) << endl;
    return 0;
}
```
