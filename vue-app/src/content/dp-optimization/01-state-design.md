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
