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
