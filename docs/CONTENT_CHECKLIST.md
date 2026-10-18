# Content checklist — items needing the owner's input

Edit facts in `src/content/*.ts`. Items are ordered by importance.

## Verify before sharing widely

- [ ] **Accenture job title.** The brief says *Advanced App Engineering Analyst*; every résumé says *Software Engineer*. The site uses the brief's title with a "Software engineering role" note. Confirm which to show.
- [ ] **TAVAS role history.** The brief says ML Intern from Jun 2025, then AI/ML Engineer from Jan 2026. The résumés say *AI Engineer, Jun 2025 – Present*. The site follows the brief. Confirm, and align the résumé PDF.
- [ ] **PGP programme wording and status.** Shown as "PGP in Data Science & Machine Learning — Intellipaat, with MITx MicroMasters", exactly as on the résumé, with no completion date. Confirm the title, completion status and the correct wording for the MITx component.
- [ ] **"Advanced Machine Learning Specialization, DeepLearning.AI" (on the résumés)** is **not** shown. The supplied certificate is the single course *Unsupervised Learning, Recommenders, Reinforcement Learning* (Feb 2024), which is shown with its verification link. Supply the specialization certificate if you hold it.
- [ ] **Employer clearance.** Confirm TAVAS is comfortable with the level of detail in the J-DOME, Visual Localization, Engine Prognostics and Perception case studies. They use only what is already on your public résumé, plus generic algorithm descriptions from your notes.

## Replace or supply

- [ ] **Résumé PDF.** `public/resume/Somashekar_Nakka_Resume.pdf` is currently a copy of the *Autonomous Robotics Engineer (Infosys)* tailored CV. That was the closest general-purpose variant: no company name inside, but the headline is robotics-focused. Replace it with a general CV. It includes your phone number.
- [ ] **Cleared quantitative results** for J-DOME (suppression depth, latency), visual localization accuracy, and PHM model accuracy, only if shareable.
- [ ] **The RUL / degradation notebook** referenced in the brief (Random Forest RUL proxy, linear mixed-effects) was not in `inputs/`. Without it, those specific methods and results are not shown.
- [ ] **Public-safe imagery**: hardware set-up photos, matched-correspondence examples, dashboard screenshots (if cleared).
- [ ] **Next steps for Engine Prognostics** and the **Medical RAG Chatbot** (currently "Owner to add").
- [ ] **GNSS receiver research**: any design docs or code for receiver stages that already exist.

## Not included (insufficient evidence)

- OpenVINS, EuRoC dataset evaluation (the résumés say VINS-Fusion and FAST-LIO2; no dataset evaluation is documented).
- Lunar Lander reinforcement learning, JobPilot (no repository or document found).
- Home Credit Default Risk (a public notebook exists, but there is not enough description for a case study).

## Optional

- [ ] Final domain → build with `SITE_URL=…` for canonical URL, sitemap and absolute OG image.
- [ ] A custom favicon or monogram if you prefer one to the beam-lobe glyph.
