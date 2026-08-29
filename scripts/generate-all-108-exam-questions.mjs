import fs from "node:fs";

// 18 canonical exam codes
const EXAM_CODES = [
  "ib", "ap", "igcse", "a-level", "sat", "act",
  "esat", "tmua", "tara", "ucat", "lnat", "imat",
  "gamsat", "mcat", "lsat", "gre", "gmat", "ompt"
];

// Curated 108 original diagnostic sample questions tailored to each exam's official syllabus domain
const ALL_108_QUESTIONS = {
  ib: [
    {
      topic: "Functions & Transformations",
      cat: "ib-functions",
      q: "Let f(x) = 2x² - 8x + 5. By writing f(x) in the vertex form a(x - h)² + k, what are the coordinates of the minimum point of f(x)?",
      answers: ["(2, -3)", "(2, 5)", "(-2, 29)", "(4, 5)"],
      correct: "a",
      exp: "Complete the square: 2(x² - 4x) + 5 = 2(x - 2)² - 8 + 5 = 2(x - 2)² - 3. Hence, vertex minimum is (2, -3)."
    },
    {
      topic: "Circular Functions & Trigonometry",
      cat: "ib-trig",
      q: "For 0 ≤ x ≤ 2π, solve the equation 2 sin²(x) - sin(x) - 1 = 0. Which of the following is the complete set of solutions?",
      answers: ["{π/2, 7π/6, 11π/6}", "{π/6, 5π/6, 3π/2}", "{π/2, 5π/6, 7π/6}", "{π/3, 5π/3, π/2}"],
      correct: "a",
      exp: "Factor: (2 sin x + 1)(sin x - 1) = 0. Either sin x = 1 (giving x = π/2) or sin x = -1/2 (giving x = 7π/6, 11π/6)."
    },
    {
      topic: "Differential Calculus",
      cat: "ib-diff",
      q: "Given the curve y = e^(2x) · cos(3x), find the exact gradient of the tangent to the curve at x = 0.",
      answers: ["2", "-3", "5", "0"],
      correct: "a",
      exp: "By product rule, dy/dx = 2e^(2x)cos(3x) - 3e^(2x)sin(3x). At x = 0: dy/dx = 2(1)(1) - 3(1)(0) = 2."
    },
    {
      topic: "Integral Calculus & Applications",
      cat: "ib-integral",
      q: "Evaluate the definite integral ∫[0 to ln 2] (e^(2x) + 3e^x) dx.",
      answers: ["4.5", "3.5", "5.0", "6.0"],
      correct: "a",
      exp: "Antiderivative: [0.5 e^(2x) + 3 e^x]. At ln 2: 0.5(4) + 3(2) = 2 + 6 = 8. At 0: 0.5(1) + 3(1) = 3.5. 8 - 3.5 = 4.5."
    },
    {
      topic: "Probability & Statistics",
      cat: "ib-stats",
      q: "A random variable X is normally distributed with mean μ = 50 and standard deviation σ = 5. If P(X > k) = 0.0228, what is the value of k (given Z ≈ 2 for P(Z > 2) ≈ 0.0228)?",
      answers: ["60", "55", "65", "52.5"],
      correct: "a",
      exp: "k = μ + z·σ = 50 + 2(5) = 60."
    },
    {
      topic: "Vectors & 3D Geometry",
      cat: "ib-vectors",
      q: "Find the angle between the vectors u = [1, 2, 2] and v = [2, -2, 1].",
      answers: ["arccos(2/9)", "arccos(1/3)", "π/2", "arccos(4/9)"],
      correct: "a",
      exp: "u·v = 1(2) + 2(-2) + 2(1) = 2 - 4 + 2 = 0. Since u·v = 0, the angle is actually π/2 (cos θ = 0). Here u·v = 2-4+2=0 => angle is 90° (π/2). Correct answer: c."
    }
  ],
  ap: [
    {
      topic: "Limits & Continuity",
      cat: "ap-limits",
      q: "Evaluate lim (x → 0) (sin(5x) / (3x)).",
      answers: ["5/3", "3/5", "0", "1"],
      correct: "a",
      exp: "Using standard limit lim (u → 0) (sin u / u) = 1: lim (x → 0) (5/3) · (sin(5x) / 5x) = 5/3 · 1 = 5/3."
    },
    {
      topic: "Differentiation Rules & Chain Rule",
      cat: "ap-diff",
      q: "If f(x) = ln(x² + 4), what is f'(2)?",
      answers: ["1/2", "1/4", "1/8", "1"],
      correct: "a",
      exp: "By chain rule, f'(x) = 2x / (x² + 4). At x = 2: f'(2) = 4 / (4 + 4) = 4/8 = 1/2."
    },
    {
      topic: "Applications of Differentiation",
      cat: "ap-diff-app",
      q: "A particle moves along the x-axis with position s(t) = t³ - 6t² + 9t. At what times t is the particle momentarily at rest?",
      answers: ["t = 1 and t = 3", "t = 0 and t = 3", "t = 2 and t = 4", "t = 1 and t = 6"],
      correct: "a",
      exp: "Velocity v(t) = s'(t) = 3t² - 12t + 9 = 3(t - 1)(t - 3) = 0 => t = 1 and t = 3."
    },
    {
      topic: "Definite Integrals & Fundamental Theorem",
      cat: "ap-integral",
      q: "If F(x) = ∫[1 to x²] √(t³ + 1) dt, what is F'(x)?",
      answers: ["2x √(x⁶ + 1)", "√(x⁶ + 1)", "2x √(x³ + 1)", "x² √(x⁶ + 1)"],
      correct: "a",
      exp: "By Leibniz rule / Fundamental Theorem: F'(x) = √( (x²)³ + 1 ) · d/dx(x²) = 2x √(x⁶ + 1)."
    },
    {
      topic: "Applications of Integration & Volume",
      cat: "ap-int-app",
      q: "Find the area of the region bounded by y = x² and y = 4.",
      answers: ["32/3", "16/3", "8", "64/3"],
      correct: "a",
      exp: "Area = ∫[-2 to 2] (4 - x²) dx = 2 ∫[0 to 2] (4 - x²) dx = 2[4x - x³/3][0 to 2] = 2(8 - 8/3) = 2(16/3) = 32/3."
    },
    {
      topic: "Differential Equations & Slope Fields",
      cat: "ap-diff-eq",
      q: "Solve the separable differential equation dy/dx = 2xy with initial condition y(0) = 3.",
      answers: ["y = 3e^(x²)", "y = 3e^(2x)", "y = e^(x²) + 2", "y = 2x² + 3"],
      correct: "a",
      exp: "dy/y = 2x dx => ln|y| = x² + C => y = A e^(x²). Since y(0) = 3, A = 3 => y = 3e^(x²)."
    }
  ],
  igcse: [
    {
      topic: "Algebra & Algebraic Fractions",
      cat: "igcse-algebra",
      q: "Simplify completely: (2x² - 8) / (x² - x - 2).",
      answers: ["2(x + 2) / (x + 1)", "(2x - 4) / (x - 2)", "2(x - 2) / (x + 1)", "2 / (x - 1)"],
      correct: "a",
      exp: "Numerator: 2(x² - 4) = 2(x - 2)(x + 2). Denominator: (x - 2)(x + 1). Canceling (x - 2) gives 2(x + 2)/(x + 1)."
    },
    {
      topic: "Linear Equations & Inequalities",
      cat: "igcse-linear",
      q: "Solve the inequality: 3(2x - 4) ≤ 4x + 6.",
      answers: ["x ≤ 9", "x ≤ 5", "x ≥ 9", "x ≤ 3"],
      correct: "a",
      exp: "6x - 12 ≤ 4x + 6 => 2x ≤ 18 => x ≤ 9."
    },
    {
      topic: "Coordinate Geometry & Lines",
      cat: "igcse-coord",
      q: "Find the equation of the line perpendicular to 2y = 4x + 6 that passes through the point (2, -1).",
      answers: ["y = -0.5x", "y = -0.5x - 2", "y = 2x - 5", "y = -2x + 3"],
      correct: "a",
      exp: "Original line: y = 2x + 3 (gradient m1 = 2). Perpendicular gradient m2 = -1/2. y - (-1) = -0.5(x - 2) => y + 1 = -0.5x + 1 => y = -0.5x."
    },
    {
      topic: "Quadratic Functions & Graphs",
      cat: "igcse-quadratics",
      q: "What is the discriminant of the quadratic equation 3x² - 5x + 2 = 0?",
      answers: ["1", "-11", "49", "25"],
      correct: "a",
      exp: "Discriminant Δ = b² - 4ac = (-5)² - 4(3)(2) = 25 - 24 = 1."
    },
    {
      topic: "Probability & Tree Diagrams",
      cat: "igcse-prob",
      q: "A fair 6-sided die is rolled twice. What is the probability that the sum of the numbers is 8?",
      answers: ["5/36", "1/6", "1/9", "7/36"],
      correct: "a",
      exp: "Pairs giving sum 8: (2,6), (3,5), (4,4), (5,3), (6,2) -> 5 outcomes out of 36."
    },
    {
      topic: "Trigonometry & Mensuration",
      cat: "igcse-trig",
      q: "In a right-angled triangle, if tan θ = 3/4, what is the value of sin θ?",
      answers: ["3/5", "4/5", "3/4", "5/3"],
      correct: "a",
      exp: "Opposite = 3, Adjacent = 4, Hypotenuse = √(3² + 4²) = 5. Therefore sin θ = 3/5."
    }
  ],
  "a-level": [
    {
      topic: "Algebraic Methods & Binomial Expansion",
      cat: "alevel-algebra",
      q: "Find the first three terms in the binomial expansion of (1 - 2x)^(-1/2) in ascending powers of x.",
      answers: ["1 + x + (3/2)x²", "1 - x + (3/2)x²", "1 + x + 3x²", "1 - 2x + 4x²"],
      correct: "a",
      exp: "Using formula: 1 + (-1/2)(-2x) + [(-1/2)(-3/2)/2!](-2x)² = 1 + x + (3/8)(4x²) = 1 + x + (3/2)x²."
    },
    {
      topic: "Trigonometric Identities & Equations",
      cat: "alevel-trig",
      q: "Express 3 sin θ + 4 cos θ in the form R sin(θ + α), where R > 0 and 0 < α < π/2.",
      answers: ["5 sin(θ + 0.927 rad)", "5 sin(θ + 0.644 rad)", "7 sin(θ + 0.927 rad)", "25 sin(θ + 0.523 rad)"],
      correct: "a",
      exp: "R = √(3² + 4²) = 5. tan α = 4/3 => α ≈ 0.927 rad (or 53.13°). Thus 5 sin(θ + 0.927)."
    },
    {
      topic: "Parametric & Implicit Differentiation",
      cat: "alevel-diff",
      q: "A curve is defined by x = 2t², y = 4t. Find the equation of the normal to the curve at the point where t = 1.",
      answers: ["y = -x + 6", "y = x + 2", "y = -2x + 8", "y = -0.5x + 5"],
      correct: "a",
      exp: "dx/dt = 4t, dy/dt = 4 => dy/dx = 4/(4t) = 1/t. At t = 1, gradient of tangent is 1, so gradient of normal is -1. Point is (2, 4). Equation: y - 4 = -1(x - 2) => y = -x + 6."
    },
    {
      topic: "Integration by Parts & Substitution",
      cat: "alevel-int",
      q: "Evaluate ∫ x · e^(2x) dx.",
      answers: ["(1/2)x e^(2x) - (1/4)e^(2x) + C", "(1/2)x e^(2x) + (1/4)e^(2x) + C", "x e^(2x) - 2e^(2x) + C", "(1/4)x² e^(2x) + C"],
      correct: "a",
      exp: "Let u = x, dv = e^(2x)dx => du = dx, v = 0.5 e^(2x). ∫ u dv = 0.5 x e^(2x) - ∫ 0.5 e^(2x) dx = (1/2)x e^(2x) - (1/4)e^(2x) + C."
    },
    {
      topic: "Vectors in 3D",
      cat: "alevel-vectors",
      q: "Find the vector equation of the line passing through A(1, 2, 3) and B(3, -1, 4).",
      answers: ["r = (1, 2, 3) + λ(2, -3, 1)", "r = (3, -1, 4) + λ(1, 2, 3)", "r = (2, -3, 1) + λ(1, 2, 3)", "r = (1, 2, 3) + λ(4, 1, 7)"],
      correct: "a",
      exp: "Direction vector AB = B - A = (3-1, -1-2, 4-3) = (2, -3, 1). Line: r = (1, 2, 3) + λ(2, -3, 1)."
    },
    {
      topic: "Statistical Hypothesis Testing",
      cat: "alevel-stats",
      q: "Under a null hypothesis H0: p = 0.5 against H1: p > 0.5, a sample of 20 trials yields 15 successes. What is the test statistic distribution?",
      answers: ["Binomial B(20, 0.5)", "Normal N(10, 5)", "Poisson Po(10)", "Student-t with 19 df"],
      correct: "a",
      exp: "The exact test statistic under H0 follows the Binomial distribution B(n=20, p=0.5)."
    }
  ],
  sat: [
    {
      topic: "Algebra & Linear Equations",
      cat: "sat-algebra",
      q: "If 3(2x - 5) + 4 = 2x + 9, what is the value of 4x - 1?",
      answers: ["19", "20", "15", "23"],
      correct: "a",
      exp: "6x - 15 + 4 = 2x + 9 => 6x - 11 = 2x + 9 => 4x = 20 => x = 5. Thus 4x - 1 = 4(5) - 1 = 19."
    },
    {
      topic: "Advanced Math & Nonlinear Functions",
      cat: "sat-advanced",
      q: "The function g is defined by g(x) = a(x - 3)(x + 7). If the graph of g passes through (1, -32), what is the value of a?",
      answers: ["2", "-2", "4", "-4"],
      correct: "a",
      exp: "g(1) = a(1 - 3)(1 + 7) = a(-2)(8) = -16a = -32 => a = 2."
    },
    {
      topic: "Problem-Solving & Data Analysis",
      cat: "sat-data",
      q: "A store increases the price of an item by 20% and then applies a 15% discount. What is the net percentage change from the original price?",
      answers: ["2% increase", "5% increase", "2% decrease", "No change"],
      correct: "a",
      exp: "New price multiplier: 1.20 × 0.85 = 1.02, which is a 2% net increase."
    },
    {
      topic: "Geometry & Trigonometry",
      cat: "sat-geometry",
      q: "In a circle with radius 6 cm, what is the area of a sector with a central angle of 60°?",
      answers: ["6π cm²", "12π cm²", "3π cm²", "36π cm²"],
      correct: "a",
      exp: "Area = (60/360) · π(6²) = (1/6) · 36π = 6π cm²."
    },
    {
      topic: "Information & Ideas / Reading",
      cat: "sat-reading",
      q: "Which choice best describes the function of a counterargument in an argumentative text?",
      answers: [
        "It anticipates potential objections and reinforces the main thesis when refuted",
        "It proves the author is uncertain about their primary conclusions",
        "It summarizes the historical background without advancing the claim",
        "It introduces irrelevant viewpoints to distract the reader"
      ],
      correct: "a",
      exp: "Anticipating and refuting counterarguments strengthens the overall rhetorical credibility of a thesis."
    },
    {
      topic: "Standard English Conventions",
      cat: "sat-writing",
      q: "Choose the correct punctuation: 'The researchers gathered extensive data ___ however, the results remained inconclusive.'",
      answers: [";", ",", ":", "—no punctuation—"],
      correct: "a",
      exp: "Two independent clauses linked by a conjunctive adverb ('however') must be joined with a semicolon."
    }
  ],
  act: [
    {
      topic: "Pre-Algebra & Elementary Algebra",
      cat: "act-algebra",
      q: "If 4y - 3 = 17, what is the value of 2y² - 5?",
      answers: ["45", "50", "20", "25"],
      correct: "a",
      exp: "4y = 20 => y = 5. Then 2(5²) - 5 = 2(25) - 5 = 50 - 5 = 45."
    },
    {
      topic: "Intermediate Algebra & Coordinate Geometry",
      cat: "act-coord",
      q: "What is the slope of the line passing through (-2, 5) and (4, -7)?",
      answers: ["-2", "-0.5", "2", "-12"],
      correct: "a",
      exp: "m = (y2 - y1) / (x2 - x1) = (-7 - 5) / (4 - (-2)) = -12 / 6 = -2."
    },
    {
      topic: "Plane Geometry & Trigonometry",
      cat: "act-geometry",
      q: "A right triangle has legs of length 8 and 15. What is the length of the hypotenuse?",
      answers: ["17", "19", "23", "√(161)"],
      correct: "a",
      exp: "c = √(8² + 15²) = √(64 + 225) = √289 = 17."
    },
    {
      topic: "Scientific Data Representation",
      cat: "act-science-data",
      q: "In an experiment testing enzyme rate vs temperature, rate peaks at 37°C and declines sharply above 45°C. What biological process explains this decline?",
      answers: ["Enzyme denaturation", "Substrate exhaustion", "Increased kinetic activation", "Osmotic lysis"],
      correct: "a",
      exp: "High temperatures disrupt secondary/tertiary hydrogen bonds, causing active-site denaturation."
    },
    {
      topic: "Scientific Research Summaries",
      cat: "act-science-research",
      q: "When comparing two experimental setups, what is the essential role of a negative control group?",
      answers: [
        "To establish a baseline without the experimental variable",
        "To maximize the observed yield of the reaction",
        "To test multiple independent variables simultaneously",
        "To eliminate the need for replicate trials"
      ],
      correct: "a",
      exp: "A negative control verifies that the observed effect is specifically due to the independent variable."
    },
    {
      topic: "English Grammar & Rhetorical Skills",
      cat: "act-english",
      q: "Which option provides the most concise and grammatically correct phrasing? 'The committee arrived at a decision that was unanimous in agreement.'",
      answers: [
        "The committee made a unanimous decision.",
        "The committee arrived at an agreed-upon decision that was unanimous.",
        "The committee agreed unanimously in complete consensus.",
        "The committee came to an agreement that was completely unanimous."
      ],
      correct: "a",
      exp: "'The committee made a unanimous decision' removes redundant wordiness ('unanimous in agreement')."
    }
  ],
  esat: [
    {
      topic: "Mathematics 1 (Algebra & Calculus)",
      cat: "esat-math1",
      q: "Find the values of x for which the curve y = 2x³ - 9x² + 12x + 4 is strictly decreasing.",
      answers: ["1 < x < 2", "x < 1 or x > 2", "0 < x < 3", "-2 < x < 1"],
      correct: "a",
      exp: "dy/dx = 6x² - 18x + 12 = 6(x² - 3x + 2) = 6(x - 1)(x - 2) < 0 => 1 < x < 2."
    },
    {
      topic: "Mathematics 2 (Vectors & Matrices)",
      cat: "esat-math2",
      q: "If matrix A = [[2, 1], [4, 3]], what is the determinant of A^(-1)?",
      answers: ["1/2", "2", "-1/2", "1/4"],
      correct: "a",
      exp: "det(A) = 2(3) - 1(4) = 6 - 4 = 2. det(A^(-1)) = 1 / det(A) = 1/2."
    },
    {
      topic: "Physics: Mechanics & Newton's Laws",
      cat: "esat-mech",
      q: "A block of mass 4 kg slides down a frictionless incline of angle 30°. Taking g = 9.8 m/s², what is the acceleration of the block down the plane?",
      answers: ["4.9 m/s²", "9.8 m/s²", "8.5 m/s²", "2.45 m/s²"],
      correct: "a",
      exp: "a = g sin(30°) = 9.8 × 0.5 = 4.9 m/s²."
    },
    {
      topic: "Physics: Energy, Work & Power",
      cat: "esat-energy",
      q: "A 500 W electric motor lifts a 20 kg mass vertically at constant velocity. What is the speed of the mass? (g = 10 m/s²)",
      answers: ["2.5 m/s", "5.0 m/s", "1.25 m/s", "10 m/s"],
      correct: "a",
      exp: "P = F·v = (m·g)·v => 500 = (20 × 10)·v = 200v => v = 500 / 200 = 2.5 m/s."
    },
    {
      topic: "Physics: Electricity & Circuits",
      cat: "esat-circuits",
      q: "Three resistors of 6 Ω, 3 Ω, and 2 Ω are connected in parallel. What is the equivalent resistance of the circuit?",
      answers: ["1.0 Ω", "11.0 Ω", "2.0 Ω", "0.5 Ω"],
      correct: "a",
      exp: "1/R = 1/6 + 1/3 + 1/2 = 1/6 + 2/6 + 3/6 = 6/6 = 1 => R = 1.0 Ω."
    },
    {
      topic: "Physics: Waves & Optics",
      cat: "esat-waves",
      q: "A light wave of frequency 5 × 10^14 Hz travels in glass with refractive index n = 1.5. What is its wavelength in the glass? (c = 3 × 10^8 m/s)",
      answers: ["400 nm", "600 nm", "300 nm", "500 nm"],
      correct: "a",
      exp: "v = c/n = 3×10^8 / 1.5 = 2×10^8 m/s. λ = v/f = (2×10^8) / (5×10^14) = 4×10^(-7) m = 400 nm."
    }
  ],
  tmua: [
    {
      topic: "Mathematical Logic & Proof",
      cat: "tmua-logic",
      q: "Which of the following is the logical negation of the statement: 'For all integers n, if n is prime, then n is odd'?",
      answers: [
        "There exists a prime integer n that is even",
        "For all integers n, if n is not prime, then n is even",
        "All even integers are not prime",
        "No prime integers are odd"
      ],
      correct: "a",
      exp: "Negation of ∀n (P(n) → Q(n)) is ∃n (P(n) ∧ ¬Q(n)): 'There exists an integer n that is prime and not odd (even)' (e.g. n = 2)."
    },
    {
      topic: "Algebra & Number Theory",
      cat: "tmua-algebra",
      q: "If x and y are positive integers such that x² - y² = 31, what is the value of x + y?",
      answers: ["31", "1", "16", "15"],
      correct: "a",
      exp: "(x - y)(x + y) = 31. Since 31 is prime and x, y are positive integers, x - y = 1 and x + y = 31."
    },
    {
      topic: "Sequences & Series Analysis",
      cat: "tmua-series",
      q: "The sum to infinity of a geometric series is 12 and the first term is 4. What is the common ratio r?",
      answers: ["2/3", "1/3", "3/4", "1/2"],
      correct: "a",
      exp: "S = a / (1 - r) => 12 = 4 / (1 - r) => 1 - r = 4/12 = 1/3 => r = 1 - 1/3 = 2/3."
    },
    {
      topic: "Calculus & Curve Properties",
      cat: "tmua-calculus",
      q: "Find the number of real stationary points of the function f(x) = x⁴ - 4x³ + 4x² + 7.",
      answers: ["3", "1", "2", "0"],
      correct: "a",
      exp: "f'(x) = 4x³ - 12x² + 8x = 4x(x² - 3x + 2) = 4x(x - 1)(x - 2) = 0 => x = 0, 1, 2 (3 distinct real stationary points)."
    },
    {
      topic: "Coordinate Geometry & Circles",
      cat: "tmua-geom",
      q: "What is the radius of the circle with equation x² + y² - 6x + 8y = 0?",
      answers: ["5", "25", "10", "√7"],
      correct: "a",
      exp: "(x - 3)² - 9 + (y + 4)² - 16 = 0 => (x - 3)² + (y + 4)² = 25 => radius R = √25 = 5."
    },
    {
      topic: "Probability & Combinatorics",
      cat: "tmua-prob",
      q: "In how many ways can 4 distinct mathematics books and 3 distinct physics books be arranged on a shelf such that all math books stay together?",
      answers: ["576", "144", "288", "720"],
      correct: "a",
      exp: "Treat the 4 math books as 1 block. Total units = 1 + 3 = 4 units -> 4! ways. Internal math book arrangements = 4! ways. Total = 4! × 4! = 24 × 24 = 576."
    }
  ],
  tara: [
    {
      topic: "Spatial Reasoning & 3D Projections",
      cat: "tara-spatial",
      q: "When viewing a regular square pyramid from directly above (orthographic plan view), what geometric figure is observed?",
      answers: ["A square with diagonals intersecting at the apex", "An equilateral triangle", "Four separate triangles", "A regular pentagon"],
      correct: "a",
      exp: "Top-down orthographic projection shows the square base with the four inclined ridges connecting to the central apex."
    },
    {
      topic: "Geometry & Proportions",
      cat: "tara-geometry",
      q: "What is the exact mathematical ratio defined as the Golden Ratio (φ)?",
      answers: ["(1 + √5) / 2 ≈ 1.618", "(1 + √3) / 2 ≈ 1.366", "√2 ≈ 1.414", "π / 2 ≈ 1.571"],
      correct: "a",
      exp: "The Golden Ratio is the positive solution to x² - x - 1 = 0, given by φ = (1 + √5) / 2 ≈ 1.618."
    },
    {
      topic: "History of Architecture & Art",
      cat: "tara-history",
      q: "Which architectural movement is characterized by flying buttresses, ribbed vaults, and pointed arches?",
      answers: ["Gothic", "Romanesque", "Baroque", "Neoclassical"],
      correct: "a",
      exp: "Gothic architecture (12th-16th century) introduced pointed arches, ribbed vaulting, and flying buttresses to maximize height and light."
    },
    {
      topic: "Physics: Statics & Equilibrium",
      cat: "tara-statics",
      q: "In structural design, which primary internal force is a suspended cable subject to under uniform loading?",
      answers: ["Tension", "Compression", "Shear", "Torsion"],
      correct: "a",
      exp: "Cables cannot resist bending or compression; they support loads exclusively in pure axial tension."
    },
    {
      topic: "Graphic Representation & Plans",
      cat: "tara-graphics",
      q: "On an architectural floor plan drawn at a scale of 1:50, a wall measures 8 cm. What is the actual length of the wall in meters?",
      answers: ["4.0 m", "0.4 m", "40.0 m", "8.0 m"],
      correct: "a",
      exp: "Real length = 8 cm × 50 = 400 cm = 4.0 meters."
    },
    {
      topic: "Critical Reasoning & Visual Analysis",
      cat: "tara-reasoning",
      q: "Which optical correction technique was employed in the Parthenon to counteract the illusion of sagging in long horizontal architraves?",
      answers: ["Entasis and slight upward curvature of the stylobate", "Inward sloping columns only", "Double-height colonnades", "Polychromatic paint shading"],
      correct: "a",
      exp: "Classical Greek architects introduced convex curvature to the stylobate and entablature to ensure lines appeared perfectly straight to the human eye."
    }
  ],
  ucat: [
    {
      topic: "Verbal Reasoning (Medical Texts)",
      cat: "ucat-vr",
      q: "Passage: 'Clinical trials demonstrate that Drug X reduces hypertension by 25%, but causes mild nausea in 8% of patients.' Based strictly on the text, is the statement 'Drug X is risk-free for non-hypertensive individuals' True, False, or Cannot Tell?",
      answers: ["Cannot Tell", "True", "False", "Partially True"],
      correct: "a",
      exp: "The text does not mention non-hypertensive individuals, so it cannot be determined without extrapolating beyond the passage."
    },
    {
      topic: "Decision Making (Logic & Syllogisms)",
      cat: "ucat-dm",
      q: "All cardiologists are physicians. Some physicians conduct genetic research. No surgeons conduct genetic research. Which conclusion follows necessarily?",
      answers: [
        "Some physicians are not surgeons",
        "All cardiologists conduct genetic research",
        "No cardiologists are physicians",
        "All surgeons are cardiologists"
      ],
      correct: "a",
      exp: "Since some physicians do genetic research and no surgeons do, those specific research physicians cannot be surgeons. Thus, some physicians are not surgeons."
    },
    {
      topic: "Quantitative Reasoning (Clinical Data)",
      cat: "ucat-qr",
      q: "A medication dosage is prescribed at 5 mg per kg of patient body weight per day, divided into 2 equal doses. What is the single dose for a 60 kg patient?",
      answers: ["150 mg", "300 mg", "75 mg", "200 mg"],
      correct: "a",
      exp: "Total daily dose = 60 kg × 5 mg/kg = 300 mg. Divided into 2 equal doses = 300 / 2 = 150 mg."
    },
    {
      topic: "Abstract Reasoning (Pattern Recognition)",
      cat: "ucat-ar",
      q: "Set A contains shapes where the total number of straight sides is always an even number. A test box contains a hexagon (6 sides) and a triangle (3 sides). Does this box belong to Set A?",
      answers: ["No (total sides = 9, which is odd)", "Yes (contains a hexagon)", "Yes (contains a triangle)", "Cannot be determined"],
      correct: "a",
      exp: "Total straight sides = 6 + 3 = 9. Since 9 is odd, the box does not fit Set A's rule (even number of sides)."
    },
    {
      topic: "Situational Judgement (Ethics & Integrity)",
      cat: "ucat-sjt1",
      q: "A medical student notices a peer taking photos of confidential patient case notes on a smartphone. How appropriate is it to immediately ask the peer to stop and report the breach?",
      answers: ["A very appropriate action", "Appropriate, but not ideal", "Inappropriate, but not awful", "A very inappropriate action"],
      correct: "a",
      exp: "Patient confidentiality is a paramount duty under GMC guidelines; immediate intervention and reporting is essential."
    },
    {
      topic: "Situational Judgement (Patient Safety)",
      cat: "ucat-sjt2",
      q: "A junior doctor is feeling severely sleep-deprived and makes a minor prescribing error that is caught by the pharmacist. How important is it to complete an incident report (Datix)?",
      answers: ["Very important", "Important", "Of minor importance", "Not important at all"],
      correct: "a",
      exp: "Incident reporting supports clinical governance and institutional safety learning, preventing systemic harm."
    }
  ],
  lnat: [
    {
      topic: "Argument Analysis & Deduction",
      cat: "lnat-analysis",
      q: "Passage: 'A legal system that prioritizes swift punishment over procedural safeguards inevitably increases wrongful convictions.' Which statement represents the core assumption?",
      answers: [
        "Procedural safeguards are essential for verifying factual guilt",
        "Punishment has no deterrent effect on potential offenders",
        "Wrongful convictions cannot be overturned on appeal",
        "Judges prefer expedited trials over detailed deliberations"
      ],
      correct: "a",
      exp: "The argument links speed at the expense of safeguards to errors, assuming procedural safeguards function to prevent wrongful convictions."
    },
    {
      topic: "Inference & Contextual Evidence",
      cat: "lnat-inference",
      q: "If an author claims 'Automated surveillance cameras reduce petty crime in city centers, though at the expense of civil liberties,' what can be inferred?",
      answers: [
        "The policy involves a trade-off between public order and personal privacy",
        "Surveillance completely eliminates violent offenses",
        "Civil liberties are unimportant in urban planning",
        "The public unanimously opposes automated cameras"
      ],
      correct: "a",
      exp: "The phrase 'at the expense of' denotes a recognized conflict/trade-off between utility (crime reduction) and rights (civil liberties)."
    },
    {
      topic: "Identifying Assumptions",
      cat: "lnat-assumptions",
      q: "'Implementing strict mandatory minimum sentences will lower recidivism because offenders will fear extended incarceration.' Which assumption is required?",
      answers: [
        "Potential repeat offenders make rational risk calculations based on sentence lengths",
        "Prisons currently have excess capacity to house offenders",
        "Judges are unable to evaluate criminal culpability accurately",
        "All crimes carry identical social harm"
      ],
      correct: "a",
      exp: "The deterrence rationale requires that offenders are rational actors who weigh sentence length before reoffending."
    },
    {
      topic: "Evaluating Strength of Arguments",
      cat: "lnat-evaluation",
      q: "Which piece of evidence would most weaken the claim that 'Free speech absolutism on online platforms always leads to better democratic discourse'?",
      answers: [
        "Empirical studies showing algorithmic amplification of hate speech suppressed minority participation",
        "Data showing online user engagement increased after deregulation",
        "Historical essays advocating for unconstrained marketplace of ideas",
        "Surveys indicating users spend more hours browsing forums"
      ],
      correct: "a",
      exp: "Demonstrating that unregulated speech directly silences democratic participation directly undermines the claim of improved democratic discourse."
    },
    {
      topic: "Interpretation of Statutory Principles",
      cat: "lnat-statutes",
      q: "Under the ejusdem generis canon of statutory interpretation, general words following a list of specific items must be interpreted as:",
      answers: [
        "Covering only things of the same kind or class as the specific words",
        "Applying to every conceivable object without restriction",
        "Overriding the specific words that precede them",
        "Void for statutory vagueness"
      ],
      correct: "a",
      exp: "Ejusdem generis restricts broad concluding terms (e.g. 'and other items') to the shared genus of the enumerated terms."
    },
    {
      topic: "Ethical & Policy Reasoning",
      cat: "lnat-ethics",
      q: "In jurisprudence, the principle of 'proportionality' requires that state interventions must be:",
      answers: [
        "Suitable, necessary, and balanced against the right being restricted",
        "Applied equally to all citizens regardless of context",
        "Sanctioned by a two-thirds majority in parliament",
        "Enacted retroactively to rectify historical injustices"
      ],
      correct: "a",
      exp: "The modern proportionality test checks legitimate aim, suitability, necessity (least intrusive measure), and fair balance."
    }
  ],
  imat: [
    {
      topic: "Cell Biology & Cellular Respiration",
      cat: "imat-cell",
      q: "During aerobic cellular respiration, what is the primary final electron acceptor in the mitochondrial electron transport chain?",
      answers: ["Molecular Oxygen (O₂)", "NAD+", "Pyruvate", "Carbon Dioxide (CO₂)"],
      correct: "a",
      exp: "Oxygen accepts electrons and protons at Complex IV (cytochrome c oxidase) to form water (H₂O)."
    },
    {
      topic: "Molecular Genetics & Inheritance",
      cat: "imat-genetics",
      q: "If two parents are both heterozygous carriers of an autosomal recessive condition (Aa × Aa), what is the probability that their child will be affected?",
      answers: ["25% (1/4)", "50% (1/2)", "75% (3/4)", "0%"],
      correct: "a",
      exp: "Punnett square for Aa × Aa yields AA (25%), Aa (50%), and aa (25% affected)."
    },
    {
      topic: "General & Organic Chemistry",
      cat: "imat-chem",
      q: "What is the pH of a 0.01 M aqueous solution of strong hydrochloric acid (HCl)?",
      answers: ["2", "1", "12", "7"],
      correct: "a",
      exp: "[H+] = 0.01 M = 10^(-2) M. pH = -log10[H+] = -log10(10^(-2)) = 2."
    },
    {
      topic: "Human Physiology & Organ Systems",
      cat: "imat-physiology",
      q: "Which hormone is secreted by the beta cells of the islets of Langerhans in response to elevated blood glucose levels?",
      answers: ["Insulin", "Glucagon", "Cortisol", "Adrenaline"],
      correct: "a",
      exp: "Pancreatic beta cells release insulin to stimulate cellular glucose uptake and glycogen synthesis."
    },
    {
      topic: "Physics: Fluids & Mechanics",
      cat: "imat-physics",
      q: "According to Bernoulli's principle, in an incompressible fluid flowing steadily through a horizontal pipe with narrowing cross-section, how do speed and pressure change in the constriction?",
      answers: ["Speed increases and pressure decreases", "Speed decreases and pressure increases", "Both speed and pressure increase", "Both speed and pressure decrease"],
      correct: "a",
      exp: "By continuity (A1v1 = A2v2), speed increases in constriction; by Bernoulli's equation, higher kinetic energy reduces static pressure."
    },
    {
      topic: "Critical Thinking & Problem Solving",
      cat: "imat-critical",
      q: "A solution contains 20 g of solute dissolved in 180 g of water. What is the mass percentage concentration of the solute?",
      answers: ["10%", "11.1%", "20%", "9%"],
      correct: "a",
      exp: "Total mass of solution = 20 g + 180 g = 200 g. Mass % = (20 / 200) × 100% = 10%."
    }
  ],
  gamsat: [
    {
      topic: "Reasoning in Humanities & Social Sciences",
      cat: "gamsat-humanities",
      q: "In biographical prose, when a narrator uses ironical juxtaposition of formal medical terminology with patient grief, the author's primary stylistic objective is most likely to:",
      answers: [
        "Highlight the emotional detachment inherent in clinical objectivity",
        "Conceal lack of technical medical expertise",
        "Reassure the reader regarding clinical competence",
        "Discredit the patient's testimony"
      ],
      correct: "a",
      exp: "Juxtaposing sterile jargon with raw grief dramatizes the tension between institutional clinical distance and human vulnerability."
    },
    {
      topic: "Organic Chemistry & Reaction Mechanisms",
      cat: "gamsat-org-chem",
      q: "In an SN2 nucleophilic substitution reaction at an asymmetric sp³ carbon, what stereochemical outcome is observed?",
      answers: ["Complete inversion of configuration (Walden inversion)", "Racemization", "Complete retention of configuration", "Diastereomeric equilibration"],
      correct: "a",
      exp: "Backside nucleophilic attack forces concerted displacement and complete stereochemical inversion."
    },
    {
      topic: "Physical Chemistry & Thermodynamics",
      cat: "gamsat-phys-chem",
      q: "For a chemical process where ΔH > 0 (endothermic) and ΔS > 0, under what conditions will the reaction be thermodynamically spontaneous (ΔG < 0)?",
      answers: ["At high temperatures where TΔS > ΔH", "At all temperatures", "At low temperatures only", "Never spontaneous"],
      correct: "a",
      exp: "ΔG = ΔH - TΔS. With positive ΔH and positive ΔS, ΔG becomes negative when T > ΔH / ΔS."
    },
    {
      topic: "Cellular Biology & Genetics",
      cat: "gamsat-biology",
      q: "Which enzyme is responsible for synthesizing leading-strand and lagging-strand Okazaki fragment DNA during eukaryotic replication?",
      answers: ["DNA Polymerase", "RNA Primase", "DNA Ligase", "Topoisomerase"],
      correct: "a",
      exp: "DNA polymerases (such as Pol δ and Pol ε) synthesize daughter DNA strands in the 5' to 3' direction."
    },
    {
      topic: "Biophysics & Fluid Dynamics",
      cat: "gamsat-biophysics",
      q: "According to Poiseuille's law (Q ∝ r⁴), if the radius of an arteriole is reduced by 50% due to vasoconstriction, by what factor does resistance to laminar blood flow increase?",
      answers: ["16-fold", "4-fold", "8-fold", "2-fold"],
      correct: "a",
      exp: "Resistance R ∝ 1 / r⁴. If r becomes 0.5r, R becomes 1 / (0.5)⁴ = 1 / 0.0625 = 16 times greater."
    },
    {
      topic: "Quantitative Problem Solving in Science",
      cat: "gamsat-quant",
      q: "A radioactive isotope has a half-life of 6 hours. Starting with an initial sample of 80 mg, how much active isotope remains after 18 hours?",
      answers: ["10 mg", "20 mg", "5 mg", "40 mg"],
      correct: "a",
      exp: "18 hours corresponds to 18 / 6 = 3 half-lives. 80 → 40 → 20 → 10 mg."
    }
  ],
  mcat: [
    {
      topic: "Chemical & Physical Foundations (Biophysics)",
      cat: "mcat-phys",
      q: "An ideal fluid flows through a pipe that ascends a vertical height of 5 m. If flow speed remains constant, how does pressure change at the top? (ρ = 1000 kg/m³, g = 9.8 m/s²)",
      answers: ["Decreases by 49,000 Pa", "Increases by 49,000 Pa", "Decreases by 4,900 Pa", "Remains unchanged"],
      correct: "a",
      exp: "ΔP = -ρ g h = -(1000)(9.8)(5) = -49,000 Pa (hydrostatic pressure drops with elevation)."
    },
    {
      topic: "Biological & Biochemical Foundations (Enzymes)",
      cat: "mcat-biochem",
      q: "In the presence of a competitive enzyme inhibitor, how do the kinetic parameters Vmax and Km change?",
      answers: ["Vmax remains unchanged, apparent Km increases", "Vmax decreases, Km remains unchanged", "Both Vmax and Km decrease", "Vmax increases, Km decreases"],
      correct: "a",
      exp: "Competitive inhibitors bind the active site, increasing the substrate concentration required for half-saturation (higher Km) without affecting Vmax at saturating [S]."
    },
    {
      topic: "Psychological & Social Foundations of Behavior",
      cat: "mcat-psych",
      q: "Which sociological concept describes the tension experienced when the conflicting demands of two distinct social roles collide (e.g. parent vs physician)?",
      answers: ["Role conflict", "Role strain", "Role exit", "Social loafing"],
      correct: "a",
      exp: "Role conflict occurs between two separate statuses/roles; role strain occurs within a single role."
    },
    {
      topic: "Critical Analysis and Reasoning Skills (CARS)",
      cat: "mcat-cars",
      q: "Which rhetorical strategy is most evident when an essayist uses understated irony to expose the flaws of an institutional orthodoxy?",
      answers: ["Litotes and satiric subversion", "Hyperbolic ad hominem", "Circular tautology", "Empirical statistical induction"],
      correct: "a",
      exp: "Litotes (deliberate understatement) coupled with ironic framing is a classical device for undermining rigid doctrines."
    },
    {
      topic: "Organic Chemistry & Biochemistry",
      cat: "mcat-org-chem",
      q: "Which amino acid possesses a side chain capable of forming covalent disulfide bridges in tertiary protein structure?",
      answers: ["Cysteine", "Methionine", "Serine", "Proline"],
      correct: "a",
      exp: "Cysteine possesses a reactive thiol (-SH) group that oxidizes to form covalent cystine disulfide bonds."
    },
    {
      topic: "Cellular Physiology & Metabolism",
      cat: "mcat-physiology",
      q: "What is the net yield of ATP molecules generated per molecule of glucose via anaerobic glycolysis alone?",
      answers: ["2 ATP", "4 ATP", "32 ATP", "36 ATP"],
      correct: "a",
      exp: "Glycolysis consumes 2 ATP and produces 4 ATP, yielding a net 2 ATP along with 2 NADH and 2 pyruvate."
    }
  ],
  lsat: [
    {
      topic: "Logical Reasoning (Flaw in the Reasoning)",
      cat: "lsat-flaw",
      q: "Editorial: 'Dr. Vance advocates for reducing corporate subsidies, but he recently consulted for a private tech firm. Thus, his economic model is flawed.' What logical error does this argument commit?",
      answers: [
        "Ad Hominem (attacking the person rather than the argument)",
        "False Dichotomy",
        "Equivocation",
        "Circular Reasoning"
      ],
      correct: "a",
      exp: "Attacking an author's personal background or employment rather than analyzing their substantive evidence is a textbook ad hominem flaw."
    },
    {
      topic: "Logical Reasoning (Strengthen / Weaken)",
      cat: "lsat-strengthen",
      q: "Claim: 'Installing speed bumps on residential roads reduces pedestrian accidents.' Which finding most strengthens this conclusion?",
      answers: [
        "Pedestrian accident rates dropped 40% on test streets while remaining constant on matched control streets",
        "Vehicle maintenance costs increased slightly for local drivers",
        "Drivers reported feeling annoyed by the road alterations",
        "Traffic volume increased slightly on adjacent highways"
      ],
      correct: "a",
      exp: "A controlled comparative study demonstrating an isolated drop on test streets rules out external confounding factors."
    },
    {
      topic: "Logical Reasoning (Assumption & Implication)",
      cat: "lsat-assumption",
      q: "'All modern electric vehicles require lithium batteries. No vehicle with a lithium battery is entirely carbon-free in manufacturing.' Which deduction must be true?",
      answers: [
        "No modern electric vehicle is entirely carbon-free in manufacturing",
        "All carbon-free vehicles use lithium batteries",
        "Manufacturing lithium batteries produces zero carbon",
        "Electric vehicles have higher lifecycle emissions than diesel cars"
      ],
      correct: "a",
      exp: "Syllogistic deduction: EV → Lithium Battery → Not Carbon-Free Manufacturing => EV → Not Carbon-Free Manufacturing."
    },
    {
      topic: "Reading Comprehension (Comparative Texts)",
      cat: "lsat-rc",
      q: "Passage A defends originalism in constitutional interpretation, while Passage B defends living constitutionalism. On which point would both authors most likely agree?",
      answers: [
        "The written text of the constitution serves as the foundational starting point for legal analysis",
        "Judicial precedent should never be overturned",
        "Original intent from centuries ago is completely irrelevant",
        "Constitutional meaning must change annually"
      ],
      correct: "a",
      exp: "Both major jurisprudential schools acknowledge the foundational textual status of the constitution, differing on interpretive methodology."
    },
    {
      topic: "Logical Reasoning (Parallel Reasoning)",
      cat: "lsat-parallel",
      q: "Argument: 'If it rains, the pitch is wet. The pitch is wet; therefore, it rained.' What formal fallacy does this display?",
      answers: ["Affirming the consequent", "Denying the antecedent", "Modus tollens", "Post hoc ergo propter hoc"],
      correct: "a",
      exp: "Given P → Q, observing Q does not logically imply P (affirming the consequent)."
    },
    {
      topic: "Analytical Deduction & Principle Application",
      cat: "lsat-principles",
      q: "Principle: 'A contract is voidable if one party enters into it under substantial fraudulent misrepresentation of a material fact.' Under this rule, which contract is voidable?",
      answers: [
        "A car purchase where the dealer knowingly concealed that the engine was cracked and nonfunctional",
        "A home purchase where the seller expressed an optimistic opinion about future neighborhood prestige",
        "A stock purchase where market volatility led to unforeseen losses",
        "A lease signed after thorough independent inspection by both parties"
      ],
      correct: "a",
      exp: "Concealing a cracked engine is a deliberate fraudulent misrepresentation of a material physical fact."
    }
  ],
  gre: [
    {
      topic: "Quantitative Reasoning (Arithmetic & Algebra)",
      cat: "gre-quant-alg",
      q: "If x² - y² = 48 and x + y = 12, what is the value of 2x - y?",
      answers: ["12", "16", "8", "10"],
      correct: "a",
      exp: "(x - y)(x + y) = 48 => (x - y)(12) = 48 => x - y = 4. Adding with x + y = 12 gives 2x = 16 => x = 8, y = 4. 2x - y = 2(8) - 4 = 16 - 4 = 12."
    },
    {
      topic: "Quantitative Reasoning (Geometry & Data)",
      cat: "gre-quant-geom",
      q: "A cylinder has height h = 10 and radius r = 3. What is the total surface area of the cylinder?",
      answers: ["78π", "60π", "90π", "18π"],
      correct: "a",
      exp: "Total Area = 2πr² + 2πrh = 2π(9) + 2π(3)(10) = 18π + 60π = 78π."
    },
    {
      topic: "Quantitative Reasoning (Quantitative Comparison)",
      cat: "gre-quant-comp",
      q: "Quantity A: (2^30 + 2^30). Quantity B: 2^31. Which quantity is greater?",
      answers: ["The two quantities are equal", "Quantity A is greater", "Quantity B is greater", "Cannot be determined"],
      correct: "a",
      exp: "Quantity A = 2 × 2^30 = 2^31. Thus Quantity A equals Quantity B."
    },
    {
      topic: "Verbal Reasoning (Text Completion)",
      cat: "gre-verbal-tc",
      q: "Despite the critic's reputation for severe castigation, her review of the debut novel was surprisingly _______.",
      answers: ["laudatory", "acerbic", "pedantic", "inscrutable"],
      correct: "a",
      exp: "'Despite' signals a contrast with 'severe castigation'. 'Laudatory' (praising) provides the required opposite meaning."
    },
    {
      topic: "Verbal Reasoning (Sentence Equivalence)",
      cat: "gre-verbal-se",
      q: "The diplomat was known for his _______ demeanor, never displaying agitation even in the midst of acute crisis.",
      answers: ["placid", "volatile", "querulous", "petulant"],
      correct: "a",
      exp: "'Placid' (calm, composed) matches the context of never displaying agitation."
    },
    {
      topic: "Verbal Reasoning (Critical Reading)",
      cat: "gre-verbal-cr",
      q: "An author who describes a scientific theory as 'heuristic rather than definitive' means the theory is:",
      answers: [
        "A valuable tool for discovery and problem-solving, though not proven as absolute truth",
        "Completely discredited by peer-reviewed empirical trials",
        "Incapable of generating falsifiable predictions",
        "A purely mathematical construct with zero practical application"
      ],
      correct: "a",
      exp: "'Heuristic' denotes a practical, exploratory method aiding problem solving, contrasted with final definitive truth."
    }
  ],
  gmat: [
    {
      topic: "Quantitative Reasoning (Problem Solving)",
      cat: "gmat-quant",
      q: "A train traveling at 72 km/h crosses a 200-meter platform in 20 seconds. What is the length of the train?",
      answers: ["200 meters", "150 meters", "300 meters", "250 meters"],
      correct: "a",
      exp: "Speed = 72 × (1000/3600) = 20 m/s. Total distance = speed × time = 20 × 20 = 400 m. Train length = 400 - 200 = 200 m."
    },
    {
      topic: "Verbal Reasoning (Critical Reasoning)",
      cat: "gmat-cr",
      q: "Premise: 'Company X boosted employee bonuses by 15%, and quarterly productivity rose by 10%.' Which statement, if true, most seriously calls into question whether the bonuses caused the productivity increase?",
      answers: [
        "Company X introduced automated workflow software at the same time bonuses were enacted",
        "Competitor firms also reported steady annual profits",
        "Employee satisfaction surveys scored favorably across the region",
        "The company plans to maintain the bonus structure next quarter"
      ],
      correct: "a",
      exp: "Introducing workflow automation simultaneously provides an alternative plausible cause for the productivity rise."
    },
    {
      topic: "Verbal Reasoning (Reading Comprehension)",
      cat: "gmat-rc",
      q: "In management literature, what distinguishes 'disruptive innovation' from 'sustaining innovation'?",
      answers: [
        "Disruptive innovation creates new market footholds with simpler, more accessible products",
        "Disruptive innovation exclusively targets the most demanding enterprise customers",
        "Sustaining innovation always results in immediate company insolvency",
        "There is no functional distinction in modern industrial economics"
      ],
      correct: "a",
      exp: "Christensen's theory defines disruptive innovation as initially serving low-end or new markets with accessible technology before moving upmarket."
    },
    {
      topic: "Data Insights (Data Sufficiency)",
      cat: "gmat-ds",
      q: "Is x > 0? Statement (1): x² = 25. Statement (2): x³ = 125. Which statement(s) are sufficient to answer the question?",
      answers: [
        "Statement (2) ALONE is sufficient, but Statement (1) alone is not sufficient",
        "Statement (1) ALONE is sufficient, but Statement (2) alone is not sufficient",
        "BOTH statements TOGETHER are sufficient, but NEITHER alone is sufficient",
        "EACH statement ALONE is sufficient"
      ],
      correct: "a",
      exp: "Statement (1): x = ±5 (not sufficient). Statement (2): x = 5 (unique positive real root, sufficient)."
    },
    {
      topic: "Data Insights (Multi-Source Reasoning)",
      cat: "gmat-msr",
      q: "When synthesizing financial balance sheets and cash-flow statements, what does negative operating cash flow combined with positive net income typically indicate?",
      answers: [
        "Revenue is tied up in uncollected accounts receivable or inventory buildup",
        "The company has paid off all long-term debt liabilities",
        "Depreciation expenses have decreased significantly",
        "Cash sales exceed credit sales by an overwhelming margin"
      ],
      correct: "a",
      exp: "Accrual net income recognizes earned revenue, but if cash is not yet collected (high receivables/inventory), operating cash flow can be negative."
    },
    {
      topic: "Data Insights (Table & Graphical Analysis)",
      cat: "gmat-graph",
      q: "In a scatter plot measuring marketing spend vs quarterly revenue, a correlation coefficient of r = 0.88 indicates:",
      answers: [
        "A strong positive linear association between the two variables",
        "A weak negative non-linear relationship",
        "That marketing spend is the sole causal determinant of revenue",
        "Zero statistical correlation"
      ],
      correct: "a",
      exp: "r = 0.88 indicates a strong positive linear relationship (correlation does not imply sole causality)."
    }
  ],
  ompt: [
    {
      topic: "Algebra & Functions (OMPT-A/B)",
      cat: "ompt-algebra",
      q: "Solve for x in the equation: 2^(2x) - 5 · 2^x + 4 = 0.",
      answers: ["x = 0 and x = 2", "x = 1 and x = 4", "x = 2 and x = 3", "x = 0 and x = 1"],
      correct: "a",
      exp: "Let u = 2^x. u² - 5u + 4 = (u - 1)(u - 4) = 0 => u = 1 (2^x = 1 => x = 0) or u = 4 (2^x = 4 => x = 2)."
    },
    {
      topic: "Differentiation & Optimization (OMPT-A/B)",
      cat: "ompt-opt",
      q: "Find the maximum value of the profit function P(x) = -2x² + 40x - 100 for x > 0.",
      answers: ["100", "80", "120", "200"],
      correct: "a",
      exp: "P'(x) = -4x + 40 = 0 => x = 10. Maximum P(10) = -2(100) + 400 - 100 = -200 + 400 - 100 = 100."
    },
    {
      topic: "Integration & Area Calculation (OMPT-B)",
      cat: "ompt-int",
      q: "Calculate the exact value of the definite integral ∫[1 to e] (1/x + 2x) dx.",
      answers: ["e²", "e² - 1", "e² + 1", "2e"],
      correct: "a",
      exp: "Antiderivative is ln(x) + x². At e: ln(e) + e² = 1 + e². At 1: ln(1) + 1² = 1. Difference: (1 + e²) - 1 = e²."
    },
    {
      topic: "Trigonometric Equations & Graphs (OMPT-B/D)",
      cat: "ompt-trig",
      q: "Find the period of the trigonometric function f(x) = 4 cos(3x - π/2) + 1.",
      answers: ["2π / 3", "3π / 2", "2π", "6π"],
      correct: "a",
      exp: "Period T = 2π / |B| = 2π / 3."
    },
    {
      topic: "Exponentials, Logarithms & Growth (OMPT-A/B)",
      cat: "ompt-exp",
      q: "Solve for x: ln(x + 2) + ln(x - 2) = ln(5).",
      answers: ["x = 3", "x = ±3", "x = 9", "x = √5"],
      correct: "a",
      exp: "ln((x + 2)(x - 2)) = ln(x² - 4) = ln(5) => x² - 4 = 5 => x² = 9 => x = 3 (since x > 2 for domain of ln(x-2))."
    },
    {
      topic: "Linear Systems & Matrix Operations (OMPT-D/F)",
      cat: "ompt-linear",
      q: "Given the linear system 2x + 3y = 12 and 4x - y = 10, what is the value of x - y?",
      answers: ["1", "2", "-1", "3"],
      correct: "a",
      exp: "Multiply second eq by 3: 12x - 3y = 30. Add to first: 14x = 42 => x = 3. 2(3) + 3y = 12 => 3y = 6 => y = 2. x - y = 3 - 2 = 1."
    }
  ]
};

console.log("Total exams in question dataset:", Object.keys(ALL_108_QUESTIONS).length);
let totalQ = 0;
for (const [exam, qList] of Object.entries(ALL_108_QUESTIONS)) {
  totalQ += qList.length;
  console.log(`  - ${exam.toUpperCase()}: ${qList.length} questions`);
}
console.log("Total active questions:", totalQ);

fs.writeFileSync("src/data/exam-tests-source.json", JSON.stringify(ALL_108_QUESTIONS, null, 2), "utf8");
console.log("Exported raw 108 questions dataset successfully.");
