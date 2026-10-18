import type { Credential, Experience, NotebookEntry } from '../types/content'

/**
 * Single source of truth for personal facts.
 * Sources: the 32 tailored résumés in inputs/tailored_cvs (facts below appear identically in all of them),
 * certificates in inputs/certificates, and the owner's stated work history.
 */
export const profile = {
  name: 'Somashekar Reddy Nakka',
  shortName: 'S.R. Nakka',
  firstName: 'Somashekar',
  role: 'AI/ML Engineer',
  disciplines: ['Computer Vision', 'Signal Processing', 'Autonomous Systems'],
  location: 'India',
  experience: '~2.5 years of professional experience',
  heroStatement:
    'I build intelligence for systems that have to work in the physical world — where signals are weak, sensors drift and interference is real.',
  email: 'shekar3reddy4@gmail.com',
  /** The phone number appears on the résumé PDF. It is deliberately not rendered on the site. */
  showPhone: false,
  links: {
    linkedin: 'https://www.linkedin.com/in/somashekar39',
    github: 'https://github.com/SomaShekar2678',
  },
  resume: {
    href: './resume/Somashekar_Nakka_Resume.pdf',
    label: 'Résumé (PDF)',
    /** Set to the date the PDF in public/resume was last replaced. */
    updated: 'Oct 2026',
  },
} as const

export const about = {
  statement:
    'Most of my work sits where software intelligence meets physical engineering: antenna arrays that must hear satellites through jamming, cameras that must localise a platform when GNSS is unavailable, and engines whose health must be read from noisy telemetry.',
  paragraphs: [
    'I trained in Electronics and Communication Engineering at NIT Delhi, then began my career in software engineering at Accenture, building production document-intelligence services and healthcare classification models.',
    'At TAVAS Industries I moved closer to the hardware. I designed the software architecture for a multi-antenna GNSS anti-jamming system, implemented array-processing algorithms and took them from Python simulation onto Xilinx RFSoC — while also building visual localization, sensor-fusion and prognostics pipelines.',
    'The common thread is end-to-end ownership: from the mathematical model, through simulation, to an implementation that runs within real constraints, and then validation against real data.',
  ],
  principles: [
    {
      title: 'Model it first',
      body: 'Write down the signal model, the assumptions and the failure modes before writing code. Most bugs are modelling errors in disguise.',
    },
    {
      title: 'Simulate to learn',
      body: 'Controlled Python simulations — known geometry, SNR and jammer power — show how an algorithm behaves before hardware time is spent on it.',
    },
    {
      title: 'Implement under constraints',
      body: 'Fixed-point arithmetic, streaming data and latency budgets decide which algorithm survives. Elegance that does not fit the device does not ship.',
    },
    {
      title: 'Validate against reality',
      body: 'RF captures, raw IQ samples, telemetry and teardown records are the ground truth. Tuning follows evidence, not intuition.',
    },
  ],
  longTerm:
    'Over the long term I want to spend my career on resilient navigation, sensing and autonomy problems that matter for India.',
} as const

export const experience: Experience[] = [
  {
    company: 'TAVAS Industries',
    location: 'Bhopal, Madhya Pradesh',
    roles: [
      {
        title: 'AI/ML Engineer',
        period: 'Jan 2026 – Present',
        start: '2026-01',
        end: null,
      },
      {
        title: 'ML Intern',
        period: 'Jun 2025 – Dec 2025',
        start: '2025-06',
        end: '2025-12',
      },
    ],
    summary:
      'Signal processing, perception and prognostics for autonomous and industrial platforms — from algorithm design and simulation to real-time hardware.',
    streams: [
      {
        title: 'GNSS anti-jamming & resilient navigation',
        points: [
          'Designed the software architecture for a multi-antenna GNSS anti-jamming and interference-mitigation system: AoA/DoA estimation, adaptive beamforming, spatial filtering, null steering and jammer localization on multi-channel IQ data.',
          'Extended GNSS signal processing from single-band L1 to multi-band L1/L2/L5.',
          'Implemented covariance estimation, MUSIC/ESPRIT, MVDR/LCMV beamforming, LMS/RLS adaptive filtering and spatial null steering for CRPA arrays.',
          'Built ML-based RF interference classification (CW, chirp, pulsed, spoofed) from spectral, temporal and statistical features.',
        ],
      },
      {
        title: 'FPGA acceleration',
        points: [
          'Deployed real-time DSP pipelines on Xilinx RFSoC (Vivado, Vitis HLS) with streaming matrix operations, covariance computation and adaptive-weight processing.',
        ],
      },
      {
        title: 'Computer vision & sensor fusion',
        points: [
          'Architected an end-to-end visual localization pipeline and reduced its end-to-end latency from 22 s to 1 s.',
          'Developed EKF/ESKF multi-sensor fusion (IMU, stereo vision, GNSS) for real-time 6-DoF pose; integrated VINS-Fusion and FAST-LIO2 on ROS 2 Humble.',
        ],
      },
      {
        title: 'Predictive maintenance',
        points: [
          'Architected a prognostics and health-management pipeline for a diesel engine fleet, delivering remaining-useful-life estimates with 80% confidence intervals.',
        ],
      },
    ],
    source: 'resume',
  },
  {
    company: 'Accenture',
    location: 'Hyderabad, Telangana',
    roles: [
      {
        title: 'Advanced App Engineering Analyst',
        period: 'Oct 2022 – Nov 2023',
        start: '2022-10',
        end: '2023-11',
        note: 'Software engineering role',
      },
    ],
    summary: 'Machine learning and document-intelligence services on healthcare data.',
    streams: [
      {
        title: 'Machine learning & NLP',
        points: [
          'Trained and deployed Logistic Regression and Random Forest models to classify drug–adverse-event pairs on structured healthcare data, using LIME for interpretability.',
          'Applied generative AI and NLP to extract information from unstructured clinical-form sections such as medical histories and lab results.',
        ],
      },
      {
        title: 'Production services',
        points: [
          'Built production FastAPI services for document extraction and report generation, with Celery and Redis for asynchronous OCR and text processing.',
          'Built document-processing pipelines for structured and semi-structured PDFs (PyPDF2, Tesseract, Pandas) with ETL into database records and statistical reports.',
        ],
      },
    ],
    source: 'resume',
  },
]

export const credentials: Credential[] = [
  {
    title: 'B.Tech, Electronics & Communication Engineering',
    issuer: 'National Institute of Technology (NIT) Delhi',
    date: '2018 – 2022',
    kind: 'degree',
    source: 'resume',
  },
  {
    title: 'PGP in Data Science & Machine Learning',
    issuer: 'Intellipaat, with MITx MicroMasters',
    date: '',
    kind: 'programme',
    detail: 'Postgraduate programme in data science and machine learning.',
    source: 'resume',
  },
  {
    title: 'Unsupervised Learning, Recommenders, Reinforcement Learning',
    issuer: 'DeepLearning.AI & Stanford Online (Coursera)',
    date: 'Feb 2024',
    kind: 'course',
    detail: 'Online non-credit course · Andrew Ng',
    verifyUrl: 'https://coursera.org/verify/N68E2WQTWLH5',
    image: './certificates/deeplearning-ai.webp',
    source: 'certificate',
  },
  {
    title: 'SQL (Advanced)',
    issuer: 'HackerRank',
    date: 'Jun 2024',
    kind: 'assessment',
    detail: 'Skill assessment · ID 7AA73F992311',
    verifyUrl: 'https://www.hackerrank.com/certificates/7aa73f992311',
    image: './certificates/hackerrank-sql.webp',
    source: 'certificate',
  },
]

/** Handwritten study notebooks (dates are the digitisation dates in the scan filenames). Not published. */
export const notebooks: NotebookEntry[] = [
  { topic: 'Support vector machines', date: '2024-08', pages: 2, area: 'ML' },
  { topic: 'Statistics', date: '2024-09', pages: 5, area: 'ML' },
  { topic: 'Decision trees', date: '2024-09', pages: 2, area: 'ML' },
  { topic: 'Time-series analysis', date: '2024-10', pages: 1, area: 'ML' },
  { topic: 'Random forests & XGBoost', date: '2024-10', pages: 8, area: 'ML' },
  { topic: 'Deep learning', date: '2024-11', pages: 3, area: 'ML' },
  { topic: 'Linear regression', date: '2025-03', pages: 10, area: 'ML' },
  { topic: 'AI for autonomy, perception & EW resilience — survey', date: '2025-06', pages: 38, area: 'Autonomy' },
  { topic: 'UAV navigation system — INS/EKF simulation design', date: '2025-06', pages: 3, area: 'Navigation' },
  { topic: 'GNSS anti-jamming research notebook', date: '2025-09', pages: 67, area: 'RF / GNSS' },
  { topic: 'UAV operations, safety & mission planning', date: '2025-09', pages: 39, area: 'Autonomy' },
  { topic: 'Generative AI', date: '2026-09', pages: 14, area: 'ML' },
]
