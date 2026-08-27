# English Study Club (英研社)

**An article-driven AI deep-reading tool for learning English grammar, vocabulary & language points.**

Paste any real English article — AI parses parts of speech (POS), grammar structures, language points and translations; then drill words in context with flashcards, cloze, dictation and word-choice exercises. Pure front-end, no backend, deployable to GitHub Pages.

> 🌐 **Language**: English | [简体中文 README](README.md)

<p align="center">
  <img src="assets/screens/desktop-home.png" alt="English Study Club UI preview" width="90%" />
</p>

<p align="center">
  <a href="https://fanqin314.github.io/english-study-club/"><strong>Live Demo</strong></a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#core-features">Core Features</a> ·
  <a href="#architecture">Architecture</a>
</p>

---

## Why article-driven?

Memorizing words out of context means you know the word but can't use it. English Study Club keeps **every learning activity anchored in real articles**:

1. Paste an English article; AI analyzes each sentence — parts of speech, grammar structure, language points — and translates it
2. Tap any word while reading to save it to your vocabulary notebook
3. Practice with flashcards, cloze, dictation, word-choice and gap-fill drills
4. Review with full-text re-reading, sentence-by-sentence deep reading, and vocabulary quizzes
5. Learning statistics track your mastery and drive review plans

**Reading comes first — learning features blend into reading instead of interrupting it.**

---

## Core Features

### AI Deep Parsing
- **Part-of-Speech (POS) tagging**: per-word POS annotation with customizable highlighting colors
- **Grammar structure**: sentence constituents & clause-pattern parsing
- **Language points**: auto-extracted, memorization-worthy notes
- **Translation**: sentence-level and full-text Chinese translation

### Practice Modes (4)
| Mode | Description |
|---|---|
| Flashcards | flip cards for fast memorization |
| Cloze | gap-fill exercises in context |
| Dictation | listen and spell |
| Word Choice | definition, audio, translation & fill-in drills |

### Review Modes (3)
- **Full-text Review**: immersive re-reading with 7 reading themes (book / magazine / newspaper / cute / pixel / minimal / classics)
- **Sentence Review**: re-examine the analysis of each sentence
- **Vocab Quiz**: quizzes generated from your notebook

### Vocabulary Management
- Multiple notebooks: merge, delete, rename
- Click-to-lookup dictionary; right-click shortcuts
- Mastery-level statistics per word

### Data & Ecosystem
- **Local-folder persistence**: save data to a local folder via the File System Access API — survives browser cache clears
- **JSON / TXT / MD export**: export history and notebooks with one click
- **Browser extension + Obsidian plugin**: web highlighting and video subtitles feed the same data loop
- **Import**: PDF, Word and OCR from images / camera

### UX
- Dark / light themes
- Full keyboard shortcuts (ESC to exit, Enter to submit)
- Responsive layout for desktop and mobile
- Live progress shown on mode cards

---

## Quick Start

### Live demo (zero config)

Open **https://fanqin314.github.io/english-study-club/** — a default AI API key is bundled, so deep parsing works immediately without any setup.

### Run locally

```bash
git clone https://github.com/fanqin314/english-study-club.git
cd english-study-club

# Option 1: open index.html directly (pure static app, no build)
open index.html

# Option 2: local static server (recommended, avoids CORS issues)
python -m http.server 8080
# then visit http://localhost:8080
```

### Bring your own AI API (optional)

1. Click the **Settings** button in the top-right corner
2. Fill in Base URL, API Key and model name
3. Save and use your own LLM (a working default key is bundled)

---

## Architecture

### Design philosophy

- **Pure front-end**: no backend — HTML + CSS + vanilla JavaScript (ES6+), deployable to GitHub Pages
- **Modular**: `ModuleRegistry` registration system + `EventBus`, fully decoupled components
- **Extensible**: add a feature by creating a module → registering → wiring UI, without touching existing code

### Project structure

```
english-study-club/
├── index.html                 # main entry
├── core/                      # core infrastructure
│   ├── module_registry.js     # module registry
│   ├── event_bus.js           # event bus (module communication)
│   ├── api_request.js         # AI request layer (retry/cache/errors)
│   ├── local_file_storage.js  # local-folder persistence (File System Access API)
│   ├── security.js            # security & API key handling
│   └── cache.js               # analysis cache
├── features/                  # business features
│   ├── deep_parse/            # deep parsing (POS/grammar/points/translation)
│   ├── memory_mode/           # practice & review modes
│   ├── vocabulary/            # vocabulary notebook
│   ├── history/               # history
│   ├── file_upload/           # file upload / OCR / camera
│   └── stats_tracker.js       # learning statistics
├── modules/                   # business logic
│   ├── analysis/              # article analysis
│   └── dictionary/            # dictionary service
├── ui/                        # UI layer
│   ├── main_button.js         # main buttons (deep parse / notebook / history)
│   ├── event_delegation.js    # event delegation
│   └── settings/              # settings panel (API/theme/export/storage)
└── assets/                    # styles & static assets (CSS variable theming)
```

### Module registration

```javascript
ModuleRegistry.register('MyModule', ['EventBus'], function (EventBus) {
    // module implementation
    return { /* public API */ };
});
```

### Event communication

```javascript
// emit
EventBus.emit('analysis.completed', { articleId: 'xxx' });

// listen
EventBus.on('analysis.completed', function (data) {
    // handle
});
```

---

## Development

### Adding a feature

1. Create a feature directory and JS files under `features/`
2. Register the module via `ModuleRegistry.register()`
3. Add the `<script>` tag in `index.html`
4. Communicate with existing modules through `EventBus`

### Code style

- ES6+, JSDoc comments
- SVG icons only (no emoji)
- Colors via CSS variables (`assets/css/variables.css`), dark-mode aware
- Event listeners use `addEventListener` + `_cleanupFns` cleanup to avoid memory leaks
- Re-entrancy guards on interactive elements

---

## Contributing

Issues and pull requests are welcome. Please read [ARCHITECTURE.md](ARCHITECTURE.md) first to understand the modular design.

## License

MIT License
