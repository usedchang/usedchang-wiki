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
