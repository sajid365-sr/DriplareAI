# Landing Page Update Task Checklist

- [ ] **Phase 1: Translation & Locales Setup**
  - [ ] Add new translation keys in `public/locales/en/home.json` (Hero, Demo, Channels, BeforeAfter, Pricing, FAQ, BookDemo)
  - [ ] Add new translation keys in `public/locales/bn/home.json` (bilingual support)

- [ ] **Phase 2: Individual Landing Page Components**
  - [ ] Create `components/landing/AIAgentVisual.tsx` (Hero Right AI Robot / Visual)
  - [ ] Create `components/landing/BookDemoModal.tsx` (Book Live Demo Modal)
  - [ ] Create `components/landing/DemoSection.tsx` (Section 2: Live Demo Video HTML5 Autoplay)
  - [ ] Create `components/landing/FeaturesSection.tsx` (Section 3: What our Agent Can Do)
  - [ ] Create `components/landing/ChannelsSection.tsx` (Section 4: Supported Channels)
  - [ ] Create `components/landing/BeforeAfterSection.tsx` (Section 5: Before & After Comparison)
  - [ ] Create `components/landing/PricingPreviewSection.tsx` (Section 6: Pricing Preview + Link)
  - [ ] Create `components/landing/FAQSection.tsx` (Section 7: FAQ Accordion)

- [ ] **Phase 3: Main Page Assembly**
  - [ ] Refactor `app/(root)/page.tsx` to integrate all 7 sections seamlessly

- [ ] **Phase 4: Testing & Verification**
  - [ ] Check responsive layout on Mobile/Tablet/Desktop
  - [ ] Check Dark/Light mode
  - [ ] Test Bengali/English i18n switching
