# 🧟 Dependency Rot Detector

[![npm version](https://img.shields.io/npm/v/rot-detector.svg)](https://www.npmjs.com/package/rot-detector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Find abandoned dependencies before they become security nightmares.**

A CLI tool that scans your `package.json` (NPM) or `requirements.txt` (Python) to detect **software rot** - dependencies that are abandoned, poorly maintained, or pose supply chain risks.

## 🤔 The Problem

`npm audit` and Snyk tell you about known CVEs. They **DON'T** tell you:

- 📅 A library hasn't been updated in **4 years**
- 👤 A package has only **1 maintainer** (bus factor risk)
- ⚖️ A dependency uses a **deprecated license**

This is "Software Rot" - a security bomb waiting to explode. 💣

## 🚀 Quick Start

```bash
# Install globally
npm install -g rot-detector

# Scan your project
rot-detector scan .

# Or use npx (no install)
npx rot-detector scan ./package.json
```

## 📊 Example Output

```
🧟 Dependency Rot Detector
Scanned: ./package.json

┌────────────────────────┬────────┬────────────────┬─────────────┬───────────────┬────────────┐
│ Package                │ Score  │ Last Update    │ Maintainers │ License       │ Status     │
├────────────────────────┼────────┼────────────────┼─────────────┼───────────────┼────────────┤
│ abandoned-lib          │ 🔴 15  │ 4 years ago    │ 1           │ GPL-2.0       │ Critical   │
│ old-but-ok             │ 🟡 65  │ 8 months ago   │ 2           │ MIT           │ Warning    │
│ react                  │ 🟢 95  │ 2 days ago     │ 15          │ MIT           │ Healthy    │
└────────────────────────┴────────┴────────────────┴─────────────┴───────────────┴────────────┘

Summary: 🟢 1 Healthy | 🟡 1 Warning | 🔴 1 Critical
```

## 📋 Features

| Feature | Description |
|---------|-------------|
| 🔍 **NPM + PyPI Support** | Scans `package.json` and `requirements.txt` |
| 📈 **Health Scoring** | 0-100 score based on freshness, maintainers, license |
| 🎨 **Beautiful CLI Output** | Color-coded risk indicators |
| 📊 **JSON Export** | `--json` flag for CI/CD integration |
| ⚡ **GitHub Integration** | Optional enhanced repo analysis |
| 🚨 **Threshold Checks** | Fail builds if score drops below threshold |

## ⚙️ CLI Options

```bash
rot-detector scan [path] [options]

Options:
  --json                Output results as JSON
  --threshold <score>   Fail if any dependency scores below threshold
  --github-token <tok>  GitHub token for enhanced repo analysis
  --no-github           Skip GitHub analysis (faster)
  --dev                 Include devDependencies
  -v, --verbose         Verbose output
```

## 🏆 Health Score Breakdown

Each dependency is scored 0-100 based on:

| Factor | Weight | Scoring |
|--------|--------|---------|
| **Freshness** | 40% | < 6 months = 100, > 3 years = 5 |
| **Maintainers** | 30% | 5+ = 100, 1 = 40, 0 = 10 |
| **License** | 30% | OSI approved = 100, Unknown = 60 |

### Risk Levels
- 🟢 **Healthy** (80-100): Well maintained, safe to use
- 🟡 **Warning** (50-79): Review recommended
- 🔴 **Critical** (0-49): Replace immediately!

## 🔧 CI/CD Integration

### GitHub Actions

```yaml
name: Dependency Health Check
on: [push, pull_request]

jobs:
  rot-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Check for dependency rot
        run: npx rot-detector scan --threshold 50
```

### Pre-commit Hook

```bash
# .husky/pre-commit
npx rot-detector scan --threshold 60
```

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/notsointresting/rot-detector.git
cd rot-detector

# Install dependencies
npm install

# Run in development mode
npm run dev -- scan ./sample/package.json

# Build for production
npm run build

# Run tests
npm test
```

## 🤝 Contributing

Contributions are welcome! Feel free to:

1. 🐛 Report bugs
2. 💡 Suggest features
3. 🔀 Submit pull requests

## 📄 License

MIT © [notsointresting](https://github.com/notsointresting)

---

<p align="center">
  Made with 🧟 by developers who got burned by abandoned dependencies
</p>
