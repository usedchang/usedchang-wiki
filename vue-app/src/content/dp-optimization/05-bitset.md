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
