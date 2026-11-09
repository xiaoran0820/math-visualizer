// 内置示例：不需要模型也能体验可视化效果，同时也是作图引擎的测试用例。

export const EXAMPLES = [
  {
    id: 'quadratic',
    label: '含参二次函数',
    problem: '已知函数 $f(x)=x^2-2ax+3$，求 $f(x)$ 在区间 $[0,2]$ 上的最小值 $g(a)$。',
    analysis: {
      title: '含参二次函数在区间上的最值',
      category: '函数',
      knowns: ['$f(x)=x^2-2ax+3$，图像开口向上，对称轴为 $x=a$', '只考虑区间 $[0,2]$ 上的部分'],
      goal: '求 $f(x)$ 在 $[0,2]$ 上的最小值 $g(a)$（用 $a$ 表示）',
      layout: '对称轴 $x=a$ 随参数移动，用滑块 a 控制；区间 $[0,2]$ 上的图像单独加粗。最小值点横坐标 $m$：$a<0$ 时 $m=0$，$0\\le a\\le 2$ 时 $m=a$，$a>2$ 时 $m=2$。',
      commands: [
        'a = Slider(-1, 3, 1) "参数 a"',
        'f(x) = x^2 - 2a x + 3 "y = f(x)"',
        'g(x) = Function(x^2 - 2a x + 3, 0, 2) #hl',
        'Segment((0, 0), (2, 0)) #hl',
        'l: x = a "x = a" #aux',
        'm = If(a < 0, 0, If(a > 2, 2, a))',
        'P = (m, f(m)) "最小值点" #result',
        'Text("a = {a} 时，最小值 g(a) = {f(m)}", (-1.8, 9.2))',
        'ZoomIn(-2, -7, 5, 10)',
      ],
      insight: '拖动滑块 a，观察对称轴 $x=a$ 与区间 $[0,2]$ 的位置关系：轴在区间左侧、区间内、区间右侧时，最小值分别在 $x=0$、顶点、$x=2$ 处取得。',
    },
    solution: `**思路**：二次函数开口向上，最小值取决于对称轴 $x=a$ 与区间 $[0,2]$ 的位置，分三种情况讨论。

1. 当 $a<0$ 时，$f(x)$ 在 $[0,2]$ 上单调递增，$g(a)=f(0)=3$；
2. 当 $0\\le a\\le 2$ 时，最小值在顶点处取得，$g(a)=f(a)=3-a^2$；
3. 当 $a>2$ 时，$f(x)$ 在 $[0,2]$ 上单调递减，$g(a)=f(2)=7-4a$。

**答案**：$$g(a)=\\begin{cases}3, & a<0\\\\ 3-a^2, & 0\\le a\\le 2\\\\ 7-4a, & a>2\\end{cases}$$`,
  },
  {
    id: 'isosceles',
    label: '等腰三角形',
    problem: '如图，在 $\\triangle ABC$ 中，$AB=AC=5$，$BC=6$，$D$ 为 $BC$ 的中点，$DE\\perp AC$ 于点 $E$。求 $DE$ 的长。',
    analysis: {
      title: '等腰三角形中的垂线段',
      category: '平面几何',
      knowns: ['$AB=AC=5$，$BC=6$', '$D$ 为 $BC$ 中点', '$DE\\perp AC$，垂足为 $E$'],
      goal: '求 $DE$ 的长',
      layout: '取 BC 中点 D 为原点，B(-3,0)、C(3,0)；由 AB=5、BD=3 得 AD=4，所以 A(0,4)。A 放在 BC 的垂直平分线上，拖动时始终保持等腰。',
      commands: [
        'ShowAxes(false)',
        'B = (-3, 0) #fixed',
        'C = (3, 0) #fixed',
        'A = Point(PerpendicularBisector(B, C), (0, 4))',
        'Polygon(A, B, C)',
        'Segment(A, B) #eq1',
        'Segment(A, C) #eq1',
        'D = Midpoint(B, C)',
        'Segment(B, D) #eq2',
        'Segment(D, C) #eq2',
        'Segment(A, D) #aux',
        'E = Foot(D, Line(A, C))',
        'Segment(D, E) #hl',
        'Angle(D, E, C)',
        'Angle(A, D, C) #aux',
        'Text("DE = {Distance(D, E)}", (1.6, 4.3))',
      ],
      insight: '等腰三角形“三线合一”：$AD\\perp BC$。在 $\\triangle ADC$ 中用面积法：$AD\\cdot DC = AC\\cdot DE$。上下拖动顶点 $A$，观察 $DE$ 如何变化。',
    },
    solution: `**思路**：连接 $AD$，利用“三线合一”得 $AD\\perp BC$，再用等面积法求 $DE$。

1. 因为 $AB=AC$，$D$ 是 $BC$ 中点，所以 $AD\\perp BC$，$DC=3$；
2. 在 $\\mathrm{Rt}\\triangle ADC$ 中，$AD=\\sqrt{AC^2-DC^2}=\\sqrt{25-9}=4$；
3. 由 $S_{\\triangle ADC}=\\dfrac12 AD\\cdot DC=\\dfrac12 AC\\cdot DE$，得 $DE=\\dfrac{4\\times 3}{5}$。

**答案**：$DE=\\dfrac{12}{5}$。`,
  },
  {
    id: 'cube',
    label: '正方体异面直线',
    problem: '在正方体 $ABCD-A_1B_1C_1D_1$ 中，$E$ 为棱 $BB_1$ 的中点，求异面直线 $AE$ 与 $B_1C$ 所成角的余弦值。',
    analysis: {
      title: '正方体中异面直线所成的角',
      category: '立体几何',
      knowns: ['正方体 $ABCD-A_1B_1C_1D_1$', '$E$ 为棱 $BB_1$ 的中点'],
      goal: '求异面直线 $AE$ 与 $B_1C$ 所成角的余弦值',
      layout: '设棱长为 2，以 D 为原点，DA、DC、DD₁ 分别为 x、y、z 轴：A(2,0,0)、B(2,2,0)、C(0,2,0)、B₁(2,2,2)，E(2,2,1)。取 BC 中点 F(1,2,0)，则 EF∥B₁C。',
      commands: [
        'D = (0, 0, 0)', 'A = (2, 0, 0)', 'B = (2, 2, 0)', 'C = (0, 2, 0)',
        'D1 = (0, 0, 2)', 'A1 = (2, 0, 2)', 'B1 = (2, 2, 2)', 'C1 = (0, 2, 2)',
        'Segment(A, B)', 'Segment(B, C)', 'Segment(C, D)', 'Segment(D, A)',
        'Segment(A1, B1)', 'Segment(B1, C1)', 'Segment(C1, D1)', 'Segment(D1, A1)',
        'Segment(A, A1)', 'Segment(B, B1)', 'Segment(C, C1)', 'Segment(D, D1)',
        'E = Midpoint(B, B1)',
        'Segment(A, E) #hl',
        'Segment(B1, C) #hl',
        'F = Midpoint(B, C) #aux',
        'Segment(E, F) #aux',
        'Segment(A, F) #aux',
        'Angle(A, E, F) "θ"',
      ],
      insight: '取 $BC$ 中点 $F$，由中位线得 $EF\\parallel B_1C$，所以 $\\angle AEF$（或其补角）就是所求角。拖动图形旋转观察，被遮挡的棱自动显示为虚线。',
    },
    solution: `**思路**：平移 $B_1C$，把异面直线所成的角转化为相交直线的夹角。

1. 取 $BC$ 中点 $F$，在 $\\triangle BB_1C$ 中，$EF$ 是中位线，所以 $EF\\parallel B_1C$，$\\angle AEF$ 即为所求角（或其补角）；
2. 设棱长为 2：$AE=\\sqrt{2^2+1^2}=\\sqrt5$，$EF=\\dfrac12 B_1C=\\sqrt2$，$AF=\\sqrt{2^2+1^2}=\\sqrt5$；
3. 由余弦定理：$\\cos\\angle AEF=\\dfrac{AE^2+EF^2-AF^2}{2\\cdot AE\\cdot EF}=\\dfrac{5+2-5}{2\\sqrt{10}}=\\dfrac{\\sqrt{10}}{10}$。

**答案**：$\\dfrac{\\sqrt{10}}{10}$。`,
  },
  {
    id: 'moving-point',
    label: '动点问题',
    problem: '如图，正方形 $ABCD$ 的边长为 4，点 $P$ 从点 $A$ 出发，沿 $A\\to B\\to C$ 运动。设点 $P$ 运动的路程为 $x$，$\\triangle APD$ 的面积为 $y$，求 $y$ 关于 $x$ 的函数关系式。',
    analysis: {
      title: '正方形边上的动点与面积',
      category: '函数',
      knowns: ['正方形 $ABCD$ 边长为 4', '点 $P$ 沿 $A\\to B\\to C$ 运动，路程为 $x$', '$y=S_{\\triangle APD}$'],
      goal: '求 $y$ 关于 $x$ 的函数关系式',
      layout: 'A(0,4)、B(0,0)、C(4,0)、D(4,4)。路程 x 用滑块 s 表示：s≤4 时 P 在 AB 上，P=(0,4−s)；s>4 时 P 在 BC 上，P=(s−4,0)。',
      commands: [
        'ShowAxes(false)',
        'A = (0, 4) #fixed', 'B = (0, 0) #fixed', 'C = (4, 0) #fixed', 'D = (4, 4) #fixed',
        'Polygon(A, B, C, D)',
        's = Slider(0, 8, 2) "路程 x"',
        'P = (If(s <= 4, 0, s - 4), If(s <= 4, 4 - s, 0)) #hl',
        'Polygon(A, P, D) #hl',
        'Text("x = {s}，y = S△APD = {Area(Polygon(A, P, D))}", (0, 5))',
      ],
      insight: '点击滑块旁的播放按钮让点 $P$ 运动：在 $AB$ 上时面积随 $x$ 均匀增大，到 $BC$ 上后高始终等于 4，面积保持不变。',
    },
    solution: `**思路**：按点 $P$ 所在的边分段讨论，以 $AD$ 为底求高。

1. 当 $0\\le x\\le 4$ 时，$P$ 在 $AB$ 上，$AP=x$，$y=\\dfrac12\\cdot AD\\cdot AP=2x$；
2. 当 $4<x\\le 8$ 时，$P$ 在 $BC$ 上，$P$ 到 $AD$ 的距离恒为 4，$y=\\dfrac12\\times4\\times4=8$。

**答案**：$$y=\\begin{cases}2x, & 0\\le x\\le 4\\\\ 8, & 4<x\\le 8\\end{cases}$$`,
  },
  {
    id: 'ellipse',
    label: '椭圆与直线',
    problem: '已知椭圆 $C:\\dfrac{x^2}{4}+\\dfrac{y^2}{3}=1$，直线 $l:y=x+m$ 与椭圆 $C$ 交于 $A$、$B$ 两点。当 $m=1$ 时，求弦长 $|AB|$。',
    analysis: {
      title: '直线与椭圆相交的弦长',
      category: '解析几何',
      knowns: ['椭圆 $C:\\dfrac{x^2}{4}+\\dfrac{y^2}{3}=1$', '直线 $l:y=x+m$ 与 $C$ 交于 $A$、$B$'],
      goal: '当 $m=1$ 时，求弦长 $|AB|$',
      layout: '椭圆 a=2、b=√3、c=1，焦点 F₁(-1,0)、F₂(1,0)。直线斜率为 1，截距 m 用滑块控制，交点由程序自动求出。',
      commands: [
        'm = Slider(-3, 3, 1) "截距 m"',
        'E: x^2/4 + y^2/3 = 1 "C"',
        'l: y = x + m "l"',
        'A = Intersect(E, l, 1)',
        'B = Intersect(E, l, 2)',
        'Segment(A, B) #hl',
        'F1 = (-1, 0) #fixed #aux',
        'F2 = (1, 0) #fixed #aux',
        'Text("|AB| = {Distance(A, B)}", (-3.7, 2.6))',
        'ZoomIn(-4, -3, 4, 3)',
      ],
      insight: '拖动滑块 $m$：直线平移时弦长随之变化，当 $|m|>\\sqrt7$ 时直线与椭圆没有交点。',
    },
    solution: `**思路**：联立直线与椭圆方程，用韦达定理和弦长公式。

1. 当 $m=1$ 时，把 $y=x+1$ 代入椭圆方程：$\\dfrac{x^2}{4}+\\dfrac{(x+1)^2}{3}=1$，整理得 $7x^2+8x-8=0$；
2. $x_1+x_2=-\\dfrac87$，$x_1x_2=-\\dfrac87$，所以 $|x_1-x_2|=\\sqrt{\\dfrac{64}{49}+\\dfrac{32}{7}}=\\dfrac{12\\sqrt2}{7}$；
3. 弦长 $|AB|=\\sqrt{1+k^2}\\,|x_1-x_2|=\\sqrt2\\cdot\\dfrac{12\\sqrt2}{7}$。

**答案**：$|AB|=\\dfrac{24}{7}$。`,
  },
  {
    id: 'meeting',
    label: '相遇问题（线段图）',
    problem: '甲、乙两车同时从相距 360 千米的两地相向而行，甲车每小时行 70 千米，乙车每小时行 50 千米。经过几小时两车相遇？相遇时甲车行了多少千米？',
    analysis: {
      title: '相向而行的相遇问题',
      category: '应用题',
      knowns: ['两地相距 360 千米', '甲车速度 70 千米/时，乙车速度 50 千米/时', '两车同时出发、相向而行'],
      goal: '求相遇时间，以及相遇时甲车行驶的路程',
      layout: '线段图：1 个单位长度表示 30 千米，全程 12 个单位。时间 t 用滑块控制：甲车位置 70t÷30，乙车位置 12−50t÷30。',
      commands: [
        'ShowAxes(false)',
        'A = (0, 0) "甲地" #fixed',
        'B = (12, 0) "乙地" #fixed',
        'Segment(A, B)',
        'Brace(A, B, "全程 360 千米")',
        't = Slider(0, 3, 1.5) "时间 t（小时）"',
        'P = (70t/30, 0) #hl #nolabel',
        'Q = (12 - 50t/30, 0) #result #nolabel',
        'Segment(A, P) #hl',
        'Segment(Q, B) #result',
        'Brace(P, A, "甲车行 {70t} 千米")',
        'Brace(B, Q, "乙车行 {50t} 千米")',
        'Text("经过 {t} 小时，两车相距 {360 - 120t} 千米", (2.2, 2.8))',
      ],
      insight: '播放时间滑块：两车每小时一共靠近 $70+50=120$ 千米，相距的路程逐渐缩短，$t=3$ 时恰好相遇。',
    },
    solution: `**思路**：相向而行时，相遇时间 = 总路程 ÷ 速度和。

1. 速度和：$70+50=120$（千米/时）；
2. 相遇时间：$360\\div120=3$（小时）；
3. 相遇时甲车行驶：$70\\times3=210$（千米）。

**答案**：经过 3 小时相遇，相遇时甲车行了 210 千米。`,
  },
  {
    id: 'sphere',
    label: '三棱锥外接球',
    problem: '在三棱锥 $P-ABC$ 中，$PA\\perp$ 平面 $ABC$，$AB\\perp BC$，$PA=AB=BC=2$。求三棱锥 $P-ABC$ 外接球的表面积。',
    analysis: {
      title: '三棱锥的外接球',
      category: '立体几何',
      knowns: ['$PA\\perp$ 平面 $ABC$', '$AB\\perp BC$', '$PA=AB=BC=2$'],
      goal: '求外接球的表面积',
      layout: '以 B 为原点：A(2,0,0)、C(0,2,0)，PA 垂直底面，P(2,0,2)。∠PAC 与 ∠PBC 都是直角，所以球心 O 是 PC 的中点 (1,1,1)。',
      commands: [
        'B = (0, 0, 0)', 'A = (2, 0, 0)', 'C = (0, 2, 0)', 'P = (2, 0, 2)',
        'Segment(P, A)', 'Segment(P, B)', 'Segment(A, B)', 'Segment(B, C)', 'Segment(C, A)',
        'Segment(P, C) #hl',
        'Angle(A, B, C)',
        'Angle(P, A, B)',
        'O = Midpoint(P, C) #result',
        'Sphere(O, Distance(O, P)) #aux',
      ],
      insight: '$\\angle PAC$ 和 $\\angle PBC$ 都是直角，斜边 $PC$ 的中点到四个顶点距离相等，就是球心。旋转图形可以看到球面与四个顶点的位置关系。',
    },
    solution: `**思路**：找到同时以 $PC$ 为斜边的两个直角三角形，球心是 $PC$ 的中点。

1. $PA\\perp$ 平面 $ABC$，所以 $PA\\perp AC$，$\\angle PAC=90^\\circ$；
2. $BC\\perp AB$，$BC\\perp PA$，所以 $BC\\perp$ 平面 $PAB$，$BC\\perp PB$，$\\angle PBC=90^\\circ$；
3. 所以 $PC$ 的中点 $O$ 到 $P$、$A$、$B$、$C$ 的距离都等于 $\\dfrac12 PC$；$PC=\\sqrt{PA^2+AB^2+BC^2}=2\\sqrt3$，$R=\\sqrt3$；
4. 表面积 $S=4\\pi R^2=12\\pi$。

**答案**：$12\\pi$。`,
  },
];
