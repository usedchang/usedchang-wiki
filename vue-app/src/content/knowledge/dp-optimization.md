# 动态规划优化方法

动态规划的核心瓶颈往往不在「会不会写转移」，而在**状态规模**与**转移代价**。当朴素 DP 的复杂度撑不住数据范围时，通常可以从以下六个方向入手：

| 序号 | 优化类别 | 核心手段 | 典型降幅 | 关键条件 |
|:---:|:---|:---|:---|:---|
| 01 | **状态设计** | 滚动数组、值域交换、等价合并 | $O(n^2)\to O(n)$ / $O(nW)\to O(nV)$ | 维度可推导 / 值域小 |
| 02 | **前缀和 / 前缀最值** | 预处理 → $O(1)$ 查区间 | $O(n^2)\to O(n)$ | 转移含区间和 / 前缀 min·max |
| 03 | **数据结构** | 单调队列、BIT、线段树 | $O(n^2)\to O(n\log n)$ | 需要滑动窗口 / 偏序 / 区间查询 |
| 04 | **矩阵快速幂 & 倍增** | 阶段跳跃 $O(\log T)$ | $O(T)\to O(\log T)$ | 转移规则恒定、阶段数极大 |
| 05 | **位运算** | `bitset` 压位批量转移 | 再除以 $\approx 64$ | 布尔 DP / 可达性 |
| 06 | **卷积** | FFT / NTT / FWT / 分治 | $O(n^2)\to O(n\log n)$ | 转移是显式卷积 / 多项式乘法 |

> **使用建议**：先审视状态定义能否瘦身（01），再看转移是否含区间聚合（02），然后判断是否需要数据结构维护（03），最后才考虑矩阵、卷积等。

## 1. 状态设计上优化 DP

> **核心理念**：好的状态定义直接决定复杂度下界。能推导的不存，能合并的不拆。

### 1.1 滚动数组 — 优化空间

当 `dp[i][*]` 只依赖 `dp[i-1][*]` 时，用两行（或一行倒序）代替完整二维表。

**01 背包 — 一维倒序**：

```cpp
// 原始: dp[i][j] = max(dp[i-1][j], dp[i-1][j-w] + v)
// 优化: 倒序枚举 j，用一维数组
for (int i = 1; i <= n; i++)
    for (int j = W; j >= w[i]; j--)
        dp[j] = max(dp[j], dp[j - w[i]] + v[i]);
```
**01 背包 — 轮换数组**：
```cpp
// 使用两个数组轮换方式优化枚举
vector<ll> dp(W + 1);
for (int i = 1; i <= n; i++) {
    vector<ll> nxt = dp;
    for (int j = w[i]; j <= W; j++)
        nxt[j] = max(nxt[j], dp[j - w[i]] + v[i]);
    dp = move(nxt);
}
```

> 完全背包正序，多重背包在模同余类上单调队列（见第 03 节）。

---

### 1.2 值域交换 — 优化时间

当「原值域很大、目标函数值域很小」时，把目标函数值变成 DP 维度。

**问题**：$N \le 100$ 个物品，背包容量 $W \le 10^9$，但每个物品价值 $v_i \le 1000$。求能装下的最大总价值。

> 传统 `dp[i][w]` → $W$ 太大；改为 `dp[i][v]` = 达到价值 $v$ 的最小重量。

```cpp
// dp[s] = 达到总价值 s 所需的最小重量
fill(dp, dp + maxV + 1, INF);
dp[0] = 0;
for (int i = 1; i <= n; i++)
    for (int s = maxV; s >= v[i]; s--)
        dp[s] = min(dp[s], dp[s - v[i]] + w[i]);
// 答案: max s where dp[s] ≤ W
```

复杂度从 $O(N \cdot W)$ 降为 $O(N \cdot \sum v_i)$。

---

## 2. 前缀和、前缀最值优化 DP

### 2.1 前缀和 — 消除区间求和

当转移涉及 `sum(l, r)` 时，预处理前缀和 $pre[i] = Σ_{k=1..i} a[k]$：

```cpp
sum(l, r) = pre[r] - pre[l-1]   // O(1)
```

**例**：$dp[i] = min_{j < i} (dp[j] + sum(j+1, i))$



---

### 2.2 前缀最值 / 前缀最小值

维护 $best[i] = min_{j ≤ i} f(j)$，转移时 $O(1)$ 取用。


**直接应用**：

```cpp
int best = INF;
for (int i = 1; i <= n; i++) {
    dp[i] = a[i] + best;      // best = min_{j < i} (dp[j] - pre[j])
    best = min(best, dp[i] - pre[i]);
}
```

> 这本质上是把 $O(n^2)$ 的枚举 $j$ 压缩成 $O(n)$ 的滚动最值。

---

### 2.3 例题：分组最小极差

有 $n$ 个元素，第 $i$ 个能量值为 $a_i$。每次魔法选择**至少 $k$ 个**元素，消耗魔力等于所选元素能量值的**极差**（最大值 − 最小值）。要求每个元素恰好被使用一次，求最小总魔力。

**数据范围**：$1 \le k \le n \le 3 \times 10^5$，$0 \le a_i \le 10^9$。

排序后线性 DP：

$$\mathrm{dp}_i = \min_{j=0,\, i-j \ge k}^{i-1} \bigl(\mathrm{dp}_j + a_i - a_{j+1}\bigr)$$

把 $\mathrm{dp}_j - a_{j+1}$ 看成整体，维护前缀最小值即可 $O(n)$。

```cpp
#include <bits/stdc++.h>
using namespace std;
#define endl '\n'
typedef long long ll;

void solve() {
    int n, k;
    cin >> n >> k;
    vector<int> a(n + 1);
    for (int i = 1; i <= n; i++) cin >> a[i];
    vector<ll> dp(n + 1, INT_MAX);
    dp[0] = 0;
    sort(a.begin() + 1, a.end());
    ll minl = INT_MAX;
    for (int i = 1; i <= n; i++) {
        if (i >= k) minl = min(minl, dp[i - k] - a[i - k + 1]);
        dp[i] = min(dp[i], minl + a[i]);
    }
    cout << dp[n] << endl;
}

int main() {
    cin.tie(0)->ios::sync_with_stdio(false);
    solve();
    return 0;
}
```

## 3. 数据结构优化 DP

### 3.1 单调队列优化

**适用形式**：转移需要滑动窗口内的最值。

```cpp
dp[i] = f(i) + min/max_{j ∈ [i-k, i-l]} ( g(j) )    其中 g(j) 只与 j 有关
```

**模板**（以求 min 为例）：

```cpp
deque<int> q;  // 存下标，对应 g 值单调递增
for (int i = 1; i <= n; i++) {
    while (!q.empty() && q.front() < i - k) q.pop_front();
    if (!q.empty()) dp[i] = f(i) + g(q.front());
    int new_idx = i - l + 1;
    if (new_idx >= 0) {
        while (!q.empty() && g(q.back()) >= g(new_idx)) q.pop_back();
        q.push_back(new_idx);
    }
}
```

---

### 3.2 树状数组 (Fenwick) — 偏序查询

当转移需要「值在某个范围内的最优前驱」：

```cpp
dp[i] = max_{j < i, a[j] < a[i]} dp[j] + 1     (LIS)
```

**BIT 维护值域上的前缀 max**：

```cpp
struct BIT {
    vector<int> tree;
    int n;
    BIT(int n) : n(n), tree(n + 1, 0) {}
    void update(int idx, int val) {
        for (; idx <= n; idx += idx & -idx)
            tree[idx] = max(tree[idx], val);
    }
    int query(int idx) {
        int res = 0;
        for (; idx > 0; idx -= idx & -idx)
            res = max(res, tree[idx]);
        return res;
    }
};

BIT bit(MAX_VAL);
for (int i = 0; i < n; i++) {
    dp[i] = bit.query(a[i] - 1) + 1;
    bit.update(a[i], dp[i]);
}
```

**推广**：二维 BIT 可处理 $j < i,\ a[j] < a[i],\ b[j] < b[i]$ 等二维偏序。

---

### 3.3 线段树 — 动态区间查询

当 BIT 只能做前缀查询，而需求涉及任意区间时，用线段树。

| DP 类型 | 线段树用法 |
|---------|-----------|
| 区间调度 DP | 扫描 $r$，线段树维护每个 $l$ 的 `dp[l-1] + val(l,r)` |
| 带位置约束的 DP | 维护 `dp[j]` 的区间最值 |
| 动态规划 + 区间加 | 懒标记批量更新 |

```cpp
// 例: 给定若干区间 [l,r,w]，选不重叠的区间使得 w 和最大
// dp[r] = max(dp[r-1], max_{区间终点=r} (dp[l-1] + w))
sort(intervals by r);
线段树维护 dp 前缀最大值;
for (auto [l, r, w] : intervals) {
    dp[r] = max(dp[r], query(1, l - 1) + w);
    update(r, dp[r]);
}
```

---

### 3.4 [例题：P2627 Mowing the Lawn G](https://www.luogu.com.cn/problem/P2627)

$N$ 只奶牛排成一排，效率 $E_i$。若连续选择超过 $K$ 只则罢工。求最大效率。

状态定义：$\mathrm{dp}_{i,0/1}$ 表示以 $i$ 结尾、第 $i$ 只选/不选的最大效率。

$$
\begin{aligned}
\mathrm{dp}_{i,0} &= \max(\mathrm{dp}_{i-1,0},\ \mathrm{dp}_{i-1,1}) \\
\mathrm{dp}_{i,1} &= \max_{j=\max(i-k,0)}^{i-1} (\mathrm{dp}_{j,0} + \mathrm{pre}_i - \mathrm{pre}_j)
\end{aligned}
$$

把 $\mathrm{dp}_{j,0} - \mathrm{pre}_j$ 作为区间待查询值，单调队列维护窗口最值：

```cpp
void solve() {
    int n, k;
    cin >> n >> k;
    vector<ll> a(n + 1);
    vector<array<ll, 2>> dp(n + 1, {0LL, 0LL});
    vector<ll> pre(n + 1);
    deque<pair<ll, ll>> Q;
    for (int i = 1; i <= n; i++) cin >> a[i], pre[i] = pre[i - 1] + a[i];
    ll ans = 0;
    Q.emplace_back(0LL, 0LL);
    for (int i = 1; i <= n; i++) {
        while (!Q.empty() && Q.front().first < i - k) Q.pop_front();
        dp[i][0] = max(dp[i - 1][0], dp[i - 1][1]);
        dp[i][1] = Q.front().second + pre[i];
        while (!Q.empty() && Q.back().second <= dp[i][0] - pre[i]) Q.pop_back();
        Q.emplace_back(i, dp[i][0] - pre[i]);
        ans = max({ans, dp[i][0], dp[i][1]});
    }
    cout << ans << endl;
}
```

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

## 5. 位运算优化

当 DP 的每一维只有 **0/1（布尔值）**，且转移是**批量位运算**时，用 `std::bitset` 将 64 个状态压缩为一个 `uint64_t`，复杂度直接除以 64。

**核心思想**：布尔 DP 的转移本质是 bitwise OR / AND / shift，正好映射到 `bitset` 的原语。

---

### 5.1 01 背包存在性（可达性）

问题：$N$ 个物品，每个体积 $w_i$，问哪些总体积可以恰好装满。

```cpp
// 朴素: dp[j] |= dp[j - w];    O(NW) 布尔操作
// bitset 优化:
bitset<MAXW + 1> dp;
dp[0] = 1;
for (int i = 1; i <= n; i++)
    dp |= dp << w[i];           // 批量移位 + OR，一次处理 64 个状态
// 复杂度: O(NW / 64)
```

> 经典题：$N \le 100,\ W \le 10^5$ → 朴素 $10^7$ 可过，但 $W \le 10^6$ 时 bitset 是唯一解。

---

### 5.2 多重背包存在性（二进制拆分 + bitset）

```cpp
bitset<MAXW + 1> dp;
dp[0] = 1;
for (int i = 1; i <= n; i++) {
    int cnt = c[i], w = w[i];
    for (int k = 1; cnt >= k; k <<= 1) {
        dp |= dp << (k * w);
        cnt -= k;
    }
    if (cnt) dp |= dp << (cnt * w);
}
```

---

### 5.3 子集和 / 可达性 DP 的通用模式

```cpp
bitset<MAXN> dp;
dp[0] = 1;

// 转移 1: 加一个数 v → 左移
dp |= dp << v;

// 转移 3: 图可达性 (传递闭包)
for (int k = 0; k < n; k++)
    for (int i = 0; i < n; i++)
        if (reach[i][k])
            reach[i] |= reach[k];    // O(n³/64)
```

---

### 5.4 Shift-And 字符串匹配

```cpp
bitset<MAXM> mask[256];
for (int i = 0; i < m; i++)
    mask[pattern[i]][i] = 1;

bitset<MAXM> D;
for (int i = 0; i < n; i++) {
    D = (D << 1) | 1;
    D &= mask[text[i]];
    if (D[m - 1]) { /* 匹配成功，终点 i */ }
}
// 复杂度 O(nm/64)
```

---

### 5.5 经典题目速查

| 题目 | 状态 | bitset 转移 | 复杂度 |
|------|------|------------|--------|
| 01 背包可达性 | `dp[j]` 能否恰好装满 $j$ | `dp \|= dp << w` | $O(NW/64)$ |
| 多重背包可达性 | 同上 + 二进制拆分 | `dp \|= dp << (k*w)` | $O(N \cdot \log C \cdot W/64)$ |
| 子集和计数 | 每个体积是否可达 | 同上 | $O(NW/64)$ |
| 图传递闭包 | `reach[i][j]` | `reach[i] \|= reach[k]` | $O(n^3/64)$ |
| Shift-And 匹配 | 匹配位置 bitset | `D = (D<<1)\|1; D &= mask[c]` | $O(nm/64)$ |

---

### 5.6 局限性

- **只能做布尔 DP**（存在性 / 可达性），不能求 max / min / sum
- **值域必须是连续的整数索引**（bitset 天然是定长数组）
- 需要 C++ `std::bitset`（或手写 `vector<uint64_t>` 做大位宽）

## 6. 卷积优化 DP

> 本节难度较高，适用于转移呈显式卷积 / 多项式乘法形式。

### 6.1 卷积形式与 FFT/NTT

当转移是标准的**离散卷积**时：

$$c[k] = \sum_{i=0}^{k} a[i] \times b[k-i] \quad \Rightarrow \quad c = a \otimes b$$

朴素 $O(n^2)$，FFT/NTT 降为 $O(n \log n)$。

- **FFT**：复数域，有精度误差，模数任意
- **NTT**：模意义下无精度误差，需模数满足 $p = c \cdot 2^k + 1$（如 998244353）

```cpp
void ntt(vector<long long>& a, bool invert) {
    int n = a.size();
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) swap(a[i], a[j]);
    }
    for (int len = 2; len <= n; len <<= 1) {
        long long wlen = power(G, (MOD - 1) / len, MOD);
        if (invert) wlen = power(wlen, MOD - 2, MOD);
        for (int i = 0; i < n; i += len) {
            long long w = 1;
            for (int j = 0; j < len / 2; j++) {
                long long u = a[i + j];
                long long v = a[i + j + len / 2] * w % MOD;
                a[i + j] = (u + v) % MOD;
                a[i + j + len / 2] = (u - v + MOD) % MOD;
                w = w * wlen % MOD;
            }
        }
    }
    if (invert) {
        long long inv_n = power(n, MOD - 2, MOD);
        for (int i = 0; i < n; i++) a[i] = a[i] * inv_n % MOD;
    }
}
```

---

### 6.2 背包方案的生成函数

**01 背包**（每种物品选或不选）：

$$P(x) = \prod_{i=1}^{N} (1 + x^{w_i})$$

$[x^s]P(x)$ 就是恰好装满体积 $s$ 的方案数。

**完全背包**（每种物品无限）：

$$P(x) = \prod_{i=1}^{N} \frac{1}{1 - x^{w_i}}$$

用分治 NTT 合并，$O(n \log^2 n)$。

---

### 6.3 分治 NTT（多项式乘法合并）

```cpp
vector<long long> solve(int l, int r) {
    if (l == r) return poly[l];
    int mid = (l + r) >> 1;
    auto L = solve(l, mid);
    auto R = solve(mid + 1, r);
    return multiply(L, R);
}
```

---

### 6.4 分治 FFT（CDQ + FFT）— 自依赖卷积

当 DP 的转移自身是卷积形式时：

$$f[0] = 1,\quad f[n] = \sum_{i=0}^{n-1} f[i] \times g[n-i]$$

**CDQ 分治 + FFT**：

```cpp
void cdq_fft(int l, int r) {
    if (l == r) return;
    int mid = (l + r) >> 1;
    cdq_fft(l, mid);

    vector<long long> A(mid - l + 1), B(r - l + 1);
    for (int i = l; i <= mid; i++) A[i - l] = f[i];
    for (int i = 0; i <= r - l; i++) B[i] = g[i];

    auto C = multiply(A, B);
    for (int i = mid + 1; i <= r; i++)
        f[i] = (f[i] + C[i - l]) % MOD;

    cdq_fft(mid + 1, r);
}
```

典型应用：**Catalan 数**、**划分数**等自卷积定义的序列。

---

### 6.5 子集卷积 (FWT / FMT)

当 DP 的状态是**位掩码**，且转移涉及子集/超集关系时：

$$f[\mathrm{mask}] = \sum_{\mathrm{sub} \subseteq \mathrm{mask}} g[\mathrm{sub}] \times h[\mathrm{mask} \setminus \mathrm{sub}]$$

**FWT (Fast Walsh-Hadamard Transform)**：$O(n \cdot 2^n)$。

| 卷积类型 | 变换 | 含义 |
|----------|------|------|
| OR 卷积 (子集) | `a[i+len] += a[i]` | $i \cup j = \mathrm{mask}$ |
| AND 卷积 (超集) | `a[i] += a[i+len]` | $i \cap j = \mathrm{mask}$ |
| XOR 卷积 | 蝴蝶变换 | $i \oplus j = \mathrm{mask}$ |

---

### 6.6 技巧速查

| 技巧 | 复杂度 | 适用场景 |
|------|--------|----------|
| 单次 FFT/NTT | $O(n \log n)$ | 两个多项式的卷积 |
| 分治 NTT | $O(n \log^2 n)$ | $N$ 个多项式相乘（背包方案） |
| 分治 FFT | $O(n \log^2 n)$ | 自依赖卷积（Catalan 等） |
| FWT | $O(n \cdot 2^n)$ | 子集/超集/XOR 卷积（状压 DP） |
| 生成函数 + 多项式求逆 | $O(n \log n)$ | 完全背包方案数 |
| 多项式 exp | $O(n \log n)$ | 集合划分计数等组合问题 |
