# Recorded AI parse fixtures

`parse.json` backs the local `RecordedAiPort`. It lets `npm run dev` and CI
run the full core loop with **zero GCP / Gemini network calls** (ADR-002) and
deterministic, reproducible parses.

## Shape

```jsonc
{
  "version": "1",
  "entries": [
    {
      "match": "drove 20 km", // canonical phrase
      "aliases": ["drove 20km"], // equivalent phrasings (optional)
      "result": {
        "items": [
          /* aiParseResultSchema */
        ],
      },
    },
  ],
}
```

`match` and every `alias` are normalized (lowercase, trimmed, collapsed
whitespace, punctuation stripped — see `normalizeInput`) before matching, so
`"Drove 20 km!"` and `"drove 20km"` both resolve. Every `result` is validated
through the `aiParseResultSchema` at construction, so a malformed recording
fails loudly at startup, not in a handler. Results carry **no** CO2e number.

## Coverage (the e2e core-loop phrases)

- `drove 20 km` — single transport item.
- `had a beef burger` — single diet item.
- `drove 10 miles and had a chicken dinner` — multi-item (transport + diet).
- `had a beef burger and a unicorn steak` — 2-item where one item is **unsourced**
  (`diet.meal.unknown` is not in the seed; the calculator routes it to the
  structured fallback and totals only the sourced item — partial-resolve).
- `used 50 kwh of electricity` — single energy item.
- `asdf` — unparseable input returns a `clarification`, no items.

## Re-record path

When the real Gemini prompt/schema changes and a fixture drifts:

1. Run the real `GeminiAiPort` against the phrase with `APP_ENV=gcp` and a
   valid `GEMINI_API_KEY`, capturing the **post-Zod-validation** `AiParseResult`
   (already stripped of any stray numeric field by the adapter).
2. Paste that object into the matching entry's `result` here (or add a new
   entry). Keep `candidateFactorKey` values inside the seeded vocabulary except
   the intentional unsourced case above.
3. Re-run `npx vitest run src/server/adapters/local/ai` — the schema validation
   in `RecordedAiPort`'s constructor is the gate.

Never hand-author a number into `result`: the schema forbids a CO2e field and
the calculator is the sole producer of emission numbers.

# Recorded AI IMAGE-parse fixtures

`image-parse.json` backs `RecordedAiPort.parseImage` — the image
meal/receipt logging flow. It runs the real Gemini multimodal model **behind the
GCP adapter only**; locally and in CI the parse is a deterministic, network-free
replay keyed off the image's content hash.

## How the key is computed

The key is the **lowercase hex sha256 of the DECODED image bytes** — not the
base64 string. The UI flow is: `fetch('/samples/<name>')` → bytes → base64 →
`POST /api/parse-image`. The local adapter base64-decodes `imageBase64`, sha256s
the bytes, and looks up the entry. So the hash the UI produces and the fixture
key agree by construction. `imageContentHash(bytes)` (exported from the local
adapter) is the single source of that hash.

## Curated sample images (`public/samples/`)

Tiny, deterministic, **valid** PNGs (photo realism is irrelevant — only the flow

- grounding matter). Their bytes hash stably:

| sample file            | sha256 (decoded bytes)                                             | recorded items (real factor keys)                                      |
| ---------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| `meal-beef-burger.png` | `c35a8fce8dfb413f498542125b853ef2cd544e0e730f6d7dcf9c780a372ba8a7` | 1× `diet.meal.beef` (`meal`)                                           |
| `meal-veg-bowl.png`    | `aae7c37bb9336a56d3edf3c0e5ddba03386ea06c8285bc7ccf4976500a03a94f` | 1× `diet.meal.vegetarian` (`meal`)                                     |
| `receipt-grocery.png`  | `7ae822782f90904aff12a31574e430df5217c50bd4e376fa0d1614093546f3de` | `diet.meal.beef` ×2, `diet.meal.chicken` ×3, `diet.meal.vegetarian` ×4 |

Every `candidateFactorKey` is a **real seed key**, so the calculator resolves it
and produces the number — the image AI only proposes keys + quantities (no CO2e).

## Regenerating the sample images (if bytes/hashes drift)

The samples are generated deterministically. To recreate them and refresh the
hashes, run a small Node script that writes solid-color 8×8 RGB PNGs; then update
both the `sha256` values in `image-parse.json` and the table above. Verify with:

```sh
npx vitest run src/server/adapters/local/ai
```

The `imageContentHash` assertion + the `RecordedAiPort` constructor (which
Zod-validates every recorded `result`) are the gates.

## Re-record path (real Gemini)

When the real `GeminiAiPort.parseImage` prompt/schema changes and a fixture
drifts:

1. Run `GeminiAiPort.parseImage` with `APP_ENV=gcp` + a valid `GEMINI_API_KEY`
   against the sample image, capturing the **post-Zod-validation** `AiParseResult`
   (already stripped of any stray numeric field by the adapter).
2. Paste that object into the matching entry's `result` (keyed by the sample's
   decoded-bytes sha256). Keep `candidateFactorKey` values inside the seeded
   vocabulary so the calculator can resolve them.
3. Re-run `npx vitest run src/server/adapters/local/ai`.

Same hard rule: never hand-author a number into a `result`.
