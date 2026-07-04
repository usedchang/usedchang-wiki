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
