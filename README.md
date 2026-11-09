# Math Visualizer — See the Problem

Photograph or type in a math problem, and a **local large model** reads it, works out what is given, and generates an **interactive figure**:

- **Photo recognition**: take a photo, pick an image, drag one in or paste a screenshot; rotate and crop to the problem area; formulas come back as LaTeX, and any figure in the original is described so it can be redrawn
- **Function graphs**: problems with parameters get sliders automatically — drag a parameter and watch the graph change, or play it as an animation
- **Plane geometry**: draggable points (moving points stay constrained to their line or circle), equal-length and right-angle marks, dashed auxiliary lines
- **Analytic geometry**: arbitrary implicit curves (ellipses, hyperbolas, …) with intersections computed for you
- **Solid geometry**: drag to rotate; hidden edges are **drawn dashed automatically**, with one-click front / side / top views
- **Segment diagrams**: word problems annotated with braces showing the quantities
- **Worked solutions** (optional): the local model explains the solution step by step

Everything runs on your own machine. No cloud API is ever called.

## Requirements

| You need | Notes |
|---|---|
| Node.js ≥ 22.9 | Runs the project (check with `node -v`) |
| [Ollama](https://ollama.com) | Runs the model locally |
| A vision model | `qwen3.5:4b-q4_K_M` recommended (about 3.3 GB); the same model is used for recognition and drawing |

## Quick start

```bash
# 1. Install Ollama and open it (or run `ollama serve`), then download the model
ollama pull qwen3.5:4b-q4_K_M

# 2. Install dependencies and start
npm install
npm start
```

Open <http://localhost:3000> in your browser. Without a model you can still click the built-in example problems on the left to see the visualizations.

**Photograph with your phone**: run `npm run lan`, connect the phone to the same Wi-Fi, and open the "phone access" address printed in the terminal.

## Configuration

Copy `.env.example` to `.env` and edit:

| Variable | Default | Meaning |
|---|---|---|
| `LLM_PROVIDER` | `ollama` | Set to `openai` to use an OpenAI-compatible local server such as LM Studio, llama.cpp server or vLLM |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama address |
| `OPENAI_BASE_URL` | `http://127.0.0.1:1234/v1` | OpenAI-compatible server address (LM Studio default port 1234) |
| `VISION_MODEL` | `qwen3.5:4b-q4_K_M` | Default model; can be switched in the top-right corner of the page |
| `TEXT_MODEL` | Same as `VISION_MODEL` | Model used for analysis and worked solutions |
| `NUM_CTX` | `16384` | Context length |
| `SOLVE_THINK` | `true` | Whether worked solutions use the model's thinking mode (more accurate, slower) |
| `PORT` / `HOST` | `3000` / `127.0.0.1` | Listen address; `HOST=0.0.0.0` allows LAN access |

With more memory you can use a larger model (for example `qwen3.5:9b` or `qwen3-vl:30b-a3b-instruct`): drawing gets more accurate and slower.

## How it works

```
photo / image ──▶ /api/recognize   Local vision model transcribes the problem (Markdown + LaTeX) and describes the original figure
                     │
typed problem ───────┤
                     ▼
             /api/analyze    The model outputs JSON (constrained by a JSON Schema): problem type, givens, goal, drawing plan, drawing commands
                     │
                     ▼
             scene.js engine   Parses the commands and computes intersections, feet of perpendiculars, midpoints, …
                     │           Command errors → /api/repair sends them back to the model for one automatic fix
                     ▼
             render2d.js (JSXGraph) / render3d.js (SVG, hidden edges dashed automatically)
```

The model only has to *understand the problem and write drawing commands* — all geometry is computed by the program — so even a small 4B model produces accurate figures.

## Drawing commands

GeoGebra-like, one command per line. Commands can be edited in the page and redrawn:

```
ShowAxes(false)
B = (-3, 0)
C = (3, 0)
A = Point(PerpendicularBisector(B, C), (0, 4))   // a moving point that can only be dragged along the perpendicular bisector
Polygon(A, B, C)
D = Midpoint(B, C)
E = Foot(D, Line(A, C))
Segment(D, E) #hl
Angle(D, E, C)
Text("DE = {Distance(D, E)}", (1.6, 4.3))         // values in {} are computed live

a = Slider(-1, 3, 1)                              // a parameter slider
f(x) = x^2 - 2a x + 3
E: x^2/4 + y^2/3 = 1                              // an arbitrary implicit curve
A1 = (2, 0, 2)                                    // a 3D point → solid mode
```

See the "Command reference" in the page for the full list.

## Project layout

```
server.js            Local server: static pages + streaming endpoints
src/llm.js           Local model client (Ollama / OpenAI-compatible)
src/prompts.js       Prompts and the output JSON schema
public/
  index.html, styles.css, app.js   Page and interaction flow
  examples.js        Built-in example problems
  lib/expr.js        Expression parser (implicit multiplication, Unicode, common LaTeX)
  lib/scene.js       The drawing-command engine
  lib/geom.js        Geometry computation (intersections, projections, root finding, convex hulls, …)
  lib/render2d.js    Plane rendering (JSXGraph)
  lib/render3d.js    Solid rendering (SVG)
  lib/markdown.js    Markdown + KaTeX
  lib/image.js       Image rotation, cropping, compression
test/scene.test.js   Engine tests (npm test)
```

## FAQ

- **The top-right corner says "local model not connected"**: make sure Ollama is open (icon in the menu bar), or run `ollama serve` in a terminal.
- **Recognition is inaccurate**: face the page straight on with even lighting; crop when several problems are in one photo; the recognized text can be edited and re-analyzed.
- **The figure is wrong**: small models occasionally write a wrong coordinate or command. Edit the drawing commands directly, or switch to a larger model.
- **The first recognition is slow**: the model has to be loaded into memory first; later runs are much faster.
