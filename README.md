# Math Visualizer — See the Problem

Photograph or type in a math problem, and a **local large model** reads it, works out what is given, and generates an **interactive figure**:

- **Photo recognition**: take a photo, pick an image, drag one in or paste a screenshot; rotate and crop to the problem area; formulas come back as LaTeX, and any figure in the original is described so it can be redrawn
- **Function graphs**: problems with parameters get sliders automatically — drag a parameter and watch the graph change, or play it as an animation
- **Plane geometry**: draggable points (moving points stay constrained to their line or circle), equal-length and right-angle marks, dashed auxiliary lines
- **Analytic geometry**: arbitrary implicit curves (ellipses, hyperbolas, …) with intersections computed for you
- **Solid geometry**: drag to rotate; hidden edges are **drawn dashed automatically**, with one-click front / side / top views
- **Segment diagrams**: word problems annotated with braces showing the quantities
- **Checked against the problem**: lengths, angles, perpendicular and parallel lines, midpoints, coordinates, equations and inequality systems are read from the problem text and checked one by one on the finished figure; if something is wrong the model is asked to fix it or try again, and equations or regions stated in the problem are drawn directly by the program
- **Worked solutions** (optional): the local model explains the solution step by step

With the default configuration, all model inference runs on your own machine and no cloud API is called. If you point `OLLAMA_HOST` or `OPENAI_BASE_URL` at another machine, photos and problem text are sent to that machine (the page warns you when this is the case). LAN mode (`npm run lan`) lets any device on the same network use the service, so only turn it on in networks you trust.

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
| `LLM_FIRST_BYTE_TIMEOUT` | `180` | Seconds to wait for the model to start answering (includes loading it into memory the first time) |
| `LLM_IDLE_TIMEOUT` | `60` | Seconds the model may stall mid-answer before the request is aborted |
| `LLM_TIMEOUT` | `300` | Maximum seconds for one request |
| `SOLVE_TIMEOUT` | `600` | Maximum seconds for a worked solution (the model thinks first) |
| `MAX_CONCURRENT` | `2` | Model requests allowed at the same time; extra requests get a clear "busy" message |
| `CORS_ORIGINS` | *(empty)* | Origins allowed to call the API from another origin, e.g. `capacitor://localhost,https://localhost` for a packaged app |

With more memory you can use a larger model (for example `qwen3.5:9b` or `qwen3-vl:30b-a3b-instruct`): drawing gets more accurate and slower.

## How it works

```
photo / image ──▶ /api/recognize   Local vision model transcribes the problem (Markdown + LaTeX) and describes the original figure;
                     │       if almost no problem text comes back, the page asks once more with a stronger instruction
typed problem ───────┤
                     ▼
             /api/analyze    The model outputs JSON (constrained by a JSON Schema): problem type, givens, goal, drawing plan, drawing commands
                     │
                     ▼
             scene.js engine   Parses the commands and computes intersections, feet of perpendiculars, midpoints, …;
                     │       a derivative the model wrote out by hand (f'(x) = …) is compared with the computed one and replaced if wrong
                     │
                     ▼
             pipeline.js     constraints.js reads checkable facts from the problem text (AB = 5, DE ⊥ AC, x²/4 + y²/3 = 1, …);
                     │       equations, inequality regions and missing parallelogram vertices stated in the problem are drawn by the program;
                     │       command errors or unmet facts → /api/repair with the specific problems, then up to two fresh attempts;
                     │       the version that satisfies the most facts is kept
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

V = Vertex(f)                                     // key points are computed by the program:
R = Root(f, 1)                                    //   Root(f, n), Extremum(f, n), Vertex(f),
P = Intersect(f, xAxis, 2)                        //   Intersect(f, xAxis, n)
z(x, y) = 2x + y                                  // a function of two variables, evaluated with z(B)

Table(Gender and short-sightedness)               // a table (probability and statistics problems)
Row(gender, short-sighted, not)                   //   the first row is the header; text needs no quotes
Row(boys, 0.6*0.3, 0.6*0.7)                       //   numbers are computed by the program; written with / they stay fractions (1/8)
```

See the "Command reference" in the page for the full list.

Figures that contain a function graph, an equation curve or an inequality region always get a standard coordinate system (axes with ticks and an origin marked O), even if the commands say `ShowAxes(false)`; plain geometry figures and segment diagrams keep their own setting. Labels that would land on top of each other (coincident points, curve names, text) are moved apart automatically.

Parsing rules worth knowing: `1/2x` means ½·x (write `1/(2x)` for the other reading), `sin 2x` means sin(2x), `-x^2` means −(x²), and `2^3^2` means 2^(3²) = 512. Below each figure the page lists every formula **as the program understood it**, so a misread formula is easy to spot. Numbers that were rounded for display are shown with ≈ instead of =; geometry found numerically (roots, intersections of curves) is approximate.

## Project layout

```
server.js            Starts the local server
src/app.js           HTTP endpoints: static files, streaming model endpoints, concurrency limit, CORS
src/llm.js           Local model client (Ollama / OpenAI-compatible) with timeouts
public/
  index.html, styles.css, app.js        Page and interaction flow
  manifest.webmanifest, sw.js, icons/   PWA: add to home screen, works offline
  examples.js        Built-in example problems
  lib/api.js         The only code that talks to the server (server address is configurable)
  lib/prompts.js     Prompts and output JSON schemas, shared by the server and the on-device (phone) model
  lib/expr.js        Expression parser (implicit multiplication, Unicode, common LaTeX) and LaTeX printer
  lib/scene.js       The drawing-command engine
  lib/geom.js        Geometry computation (intersections, projections, root finding, convex hulls, …)
  lib/pipeline.js    Analyze → check → repair / retry → keep the best version (shared by the page and the evaluation)
  lib/constraints.js Reads checkable facts from the problem text, verifies them, fills in stated equations and regions
  lib/checks.js      Geometric checks (lengths, angles, perpendicular, curves, regions, …), shared with the evaluation
  lib/repair.js      Strict acceptance rule for repairs when no facts can be checked
  lib/runs.js        Run control: a newer request always wins, stale callbacks never touch the page
  lib/render2d.js    Plane rendering (JSXGraph)
  lib/render3d.js    Solid rendering (SVG)
  lib/markdown.js    Markdown + KaTeX
  lib/image.js       Image rotation, cropping, compression
scripts/mock-llm.js      A fake model server for testing the page without Ollama (npm run mock)
scripts/build-mobile.js  Builds dist/ for packaging into a mobile app (npm run build:mobile)
scripts/eval.js          Model evaluation on a fixed problem set (npm run eval)
eval/                    Evaluation problems (problems.js: development set, holdout.js: held-out set), problem images, results,
                         and LOG.md: the development log of problems met and how they were solved (screenshots in eval/screenshots/)
docs/api.md              HTTP API and its NDJSON events
docs/mobile-porting.md   Mobile porting plan
test/                    Tests (npm test)
```

## Tests

```bash
npm test
```

None of the tests needs Ollama. They cover the expression parser (precedence and shorthand forms), numerical geometry edge cases (double roots, poles, closely spaced roots, nearly parallel lines, degenerate triangles), seeded property tests (circumcenters are equidistant, feet of perpendiculars lie on their lines, intersections lie on both objects, rotations preserve distances), the repair acceptance rule, extracting facts from problem text (Unicode and LaTeX input, and phrases that must *not* be read as facts, such as the BC = 10 inside AB + BC = 10), checking and completing figures, every built-in example satisfying all of its own extracted facts, the analyze → check → repair → retry pipeline with a fake model, run control under rapid re-runs and cancellation, malformed or truncated model output, model timeouts, the HTTP API (protocol, concurrency limit, client disconnects, CORS), the on-device client, and the JSON-Schema-to-GBNF converter used on the phone.

To try the whole page without a model, start the fake model server and point the app at it:

```bash
npm run mock
```

```bash
OLLAMA_HOST=127.0.0.1:11435 VISION_MODEL=mock-vision npm start
```

## Evaluating models

`npm run eval` runs a fixed set of problems through exactly the pipeline the page uses (`public/lib/pipeline.js`) and reports, per model: first-try drawing success, repairs accepted, figures that run, **geometric conditions satisfied** (for example AB = 5, DE ⊥ AC, D is the midpoint of BC), problems fully correct, model calls and total time per problem, OCR accuracy, speed and memory. There are two problem sets: `eval/problems.js` (17 problems, 7 of them as images for OCR), used while developing, and `eval/holdout.js` (19 problems written afterwards with different wording), used only to check that improvements carry over. The hand-written checks in these files are separate from the facts the app extracts by itself.

```bash
node scripts/eval.js --models qwen3.5:4b-q4_K_M,qwen3.5:2b-q4_K_M --pipelines baseline,best3 --set all
```

`--pipelines` compares `baseline` (one attempt, one repair on errors, as before), `verified` (checks, completion and a targeted repair) and `best3` (plus up to two fresh attempts, what the page does). Ollama must be running. Results are saved in `eval/results/`; see [docs/model-eval.md](docs/model-eval.md).

## Mobile

The page already works on phones (`npm run lan`, then "Add to Home Screen"). `npm run build:mobile` produces `dist/` for packaging with Capacitor; the packaged app asks for the computer's address on first launch. See [docs/mobile-porting.md](docs/mobile-porting.md) for the options and the remaining steps.

Running the model **on the iPhone itself** is in progress: `public/lib/api-device.js` is an on-device client with the same interface as the server API, backed by a native plugin (llama.cpp on iOS). Choose **Settings → where the model runs → on this device** (or add `?engine=device` to the address) to try that path in a desktop browser, with Ollama standing in for the native plugin. Which small model is good enough for a phone is measured in [docs/model-eval.md](docs/model-eval.md).

## FAQ

- **The top-right corner says "local model not connected"**: make sure Ollama is open (icon in the menu bar), or run `ollama serve` in a terminal.
- **Recognition is inaccurate**: face the page straight on with even lighting; crop when several problems are in one photo; the recognized text can be edited and re-analyzed.
- **The figure is wrong**: small models occasionally write a wrong coordinate or command. Edit the drawing commands directly, or switch to a larger model.
- **The first recognition is slow**: the model has to be loaded into memory first; later runs are much faster.
- **"The local model is busy"**: more than `MAX_CONCURRENT` requests are running (for example in two tabs). Wait for one to finish.
- **A request times out**: the model did not start, stalled, or took too long. Try a smaller model or raise the timeouts in `.env`.
