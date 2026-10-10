## 用等式理解移项

移项不是凭空变号。**等式两边做同一种运算**，相等关系保持不变。

行内公式：\(2x+3=7\)，所以 $x=2$。

\[
\begin{aligned}
2x+3-3 &= 7-3 \\
2x &= 4 \\
x &= 2
\end{aligned}
\]

### 方法比较

| 操作 | 左边 | 右边 | 理由 |
| :--- | ---: | ---: | :--- |
| 同减 3 | $2x$ | $4$ | 等式性质 |
| 同除以 2 | $x$ | $2$ | 非零数才能作除数 |

> 先看运算的原因，再记住简写方法。

1. 找到等式两边的运算。
2. 用相反运算逐步消去。
   - 保持左右同时处理。
   - 检查除数不为零。

- [x] 检查答案符合原式。
- [ ] 再尝试一道类似题。

### 流程图

```mermaid
flowchart LR
 A[等式两边] --> B[同时减去 3]
 B --> C[同时除以 2]
 C --> D[检查原式]
```

### 数轴图

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 140" role="img" aria-label="数轴上的两个点">
<line x1="40" y1="80" x2="440" y2="80" stroke="#233044" stroke-width="2"/>
<circle cx="200" cy="80" r="6" fill="#245ab2"/><text x="195" y="110" fill="#233044" font-size="20">2</text>
<circle cx="360" cy="80" r="6" fill="#245ab2"/><text x="355" y="110" fill="#233044" font-size="20">4</text>
<text x="100" y="40" fill="#233044" font-size="18">从 4 变为 2：除以 2</text>
</svg>
```

### 动手试一试

```learning-html
<h3>观察等式两边</h3><p>移动滑块，两边始终相等。</p>
<label for="value">每边的值</label><input id="value" aria-label="每边的值" type="range" min="1" max="6" value="2">
<output id="result" aria-live="polite">2 = 2</output>
<script>document.getElementById('value').oninput=e=>document.getElementById('result').textContent=e.target.value+' = '+e.target.value;</script>
```

### 代码原样保留

```js
const formula = "\\(x=2\\)";
```

普通行内代码 `\(x=2\)` 不应该被渲染成公式。

---

**我学到了什么：** 等式两边做相同运算。**下次怎么做：** 逐步消去、带回检查。
