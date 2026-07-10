## 📋 Pull Request Checklist

### 🔖 Category of Change
<!-- Check all that apply -->
- [ ] ✨ Feature (new functionality)
- [ ] 🐛 Bug Fix
- [ ] ♻️ Refactor (no functional change)
- [ ] 🧪 Tests (adding or improving tests)
- [ ] ⚙️ CI/Config (pipeline, tooling, config changes)
- [ ] 📝 Documentation
- [ ] 🎨 Style/UI (visual changes only)

---

### 📝 Description
<!-- Briefly describe what this PR does and why -->


### 🔗 Related Issue / Ticket
<!-- Link to the issue: Closes #123 -->
Closes #

---

### ✅ Pre-Merge Checklist

#### Code Quality
- [ ] Code follows the existing style/patterns in the codebase
- [ ] No console.log or debug statements left in
- [ ] TypeScript types are correct (no `any` shortcuts)
- [ ] ESLint passes locally (`npm run lint`)

#### Testing
- [ ] Unit tests added/updated for new logic (`npm run test:unit`)
- [ ] Integration tests pass (`npm run test:unit`)
- [ ] **E2E tested locally** with `npm run test:e2e` or `npm run test:e2e:headed`
- [ ] No existing tests broken

#### UI Changes (if applicable)
- [ ] Screenshots attached below showing before/after
- [ ] Responsive — tested on mobile viewport
- [ ] Dark mode looks correct
- [ ] Accessibility checked (keyboard nav, contrast)

#### Documentation
- [ ] README updated if new env vars / setup steps added
- [ ] Code comments added for complex logic

---

### 📸 Screenshots (for UI changes)
<!-- Drag & drop before/after screenshots here. Required for any visual change. -->

| Before | After |
|--------|-------|
|        |       |

---

### 🧪 How to Test
<!-- Steps for the reviewer to manually verify this PR -->
1. 
2. 
3. 

---

### ⚠️ Breaking Changes
<!-- List any breaking changes, migrations needed, or env var additions -->
- None / 

---

### 🗒️ Additional Notes
<!-- Anything else the reviewer should know? -->
