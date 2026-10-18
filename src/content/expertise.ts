import type { ExpertiseDomain, Maturity } from '../types/content'

export const MATURITY_META: Record<Maturity, { label: string; description: string; rank: number }> = {
  studied: {
    label: 'Studied',
    description: 'Learned and documented in study notes or coursework; not claimed as implemented.',
    rank: 1,
  },
  simulated: {
    label: 'Simulated',
    description: 'Implemented and exercised on simulated data.',
    rank: 2,
  },
  implemented: {
    label: 'Implemented',
    description: 'Implemented in professional or project code (per résumé or public repository).',
    rank: 3,
  },
  deployed: {
    label: 'Deployed',
    description: 'Running on target hardware or in a production service (per résumé).',
    rank: 4,
  },
}

export const expertise: ExpertiseDomain[] = [
  {
    id: 'ml',
    index: '01',
    title: 'AI & Machine Learning',
    short: 'AI / ML',
    summary:
      'Supervised learning, anomaly detection, survival analysis and language models — applied to telemetry, RF features and documents rather than toy datasets.',
    glyph: 'neural',
    items: [
      { name: 'Regression & classification', maturity: 'deployed', context: 'Adverse-event classification (Accenture); failure-mode classifier (TAVAS)' },
      { name: 'Feature engineering', maturity: 'implemented', context: 'RF interference features; engine residual health indicators' },
      { name: 'Model evaluation & grouped cross-validation', maturity: 'implemented', context: 'Engine-grouped CV to avoid leakage across units' },
      { name: 'Anomaly detection — Isolation Forest, change-point', maturity: 'implemented', context: 'Layered detector separating sensor faults from engine faults' },
      { name: 'Survival analysis — Kaplan–Meier, Weibull, AFT', maturity: 'implemented', context: 'Remaining-useful-life estimation with censoring' },
      { name: 'Bayesian mixed-effects degradation models', maturity: 'implemented', context: 'Fleet-level and per-engine degradation' },
      { name: 'Time-series analysis & forecasting', maturity: 'implemented', context: '1 Hz telemetry; Prophet retail forecasting (public repo)' },
      { name: 'Explainability — LIME, permutation importance', maturity: 'implemented', context: 'Interpretable healthcare classification' },
      { name: 'Generative AI, NLP & RAG', maturity: 'implemented', context: 'Clinical-form extraction (Accenture); Llama 2 RAG chatbot (public repo)' },
      { name: 'Deep learning — PyTorch, TensorFlow', maturity: 'implemented', context: 'Vision models and project work' },
      { name: 'Recommenders & reinforcement learning', maturity: 'studied', context: 'DeepLearning.AI / Stanford course; MovieLens recommender (public repo)' },
    ],
  },
  {
    id: 'dsp',
    index: '02',
    title: 'Signal Processing & Estimation',
    short: 'DSP',
    summary:
      'Array processing and statistical estimation on multi-channel IQ data: finding where interference comes from, and removing it without losing the satellites.',
    glyph: 'spectrum',
    items: [
      { name: 'FFT & spectral analysis', maturity: 'implemented', context: 'GNSS interference detection' },
      { name: 'Covariance estimation', maturity: 'deployed', context: 'Streaming covariance computation on RFSoC' },
      { name: 'Direction of arrival — MUSIC, ESPRIT', maturity: 'implemented', context: 'Multi-antenna CRPA processing' },
      { name: 'Beamforming — MVDR, LCMV, null steering', maturity: 'implemented', context: 'Adaptive spatial interference suppression' },
      { name: 'Adaptive filtering — LMS, RLS', maturity: 'implemented', context: 'Adaptive array weights' },
      { name: 'Correlation & PRN matched filtering', maturity: 'implemented', context: 'GNSS interference and spoofing detection' },
      { name: 'Cyclostationary feature analysis', maturity: 'implemented', context: 'Separating structured GNSS from jammers' },
      { name: 'Kalman filtering — EKF, ESKF', maturity: 'implemented', context: 'Sensor fusion and 6-DoF state estimation' },
      { name: 'EKF-based DoA tracking of moving sources', maturity: 'simulated', context: 'Multi-snapshot tracking of mobile jammers' },
      { name: 'Time–frequency analysis — STFT, wavelets', maturity: 'studied', context: 'Chirp and pulsed jammer characterisation' },
      { name: 'STAP, GSC, Frost beamformer', maturity: 'studied', context: 'Space–time and constrained adaptive processing' },
    ],
  },
  {
    id: 'rf',
    index: '03',
    title: 'RF & GNSS Engineering',
    short: 'RF / GNSS',
    summary:
      'GNSS reception under interference: multi-band processing, CRPA arrays and the detection of signals that should not be there.',
    glyph: 'constellation',
    items: [
      { name: 'Multi-band GNSS processing — L1 / L2 / L5', maturity: 'implemented', context: 'Extended from single-band L1' },
      { name: 'CRPA arrays & spatial null steering', maturity: 'implemented', context: 'Multi-antenna anti-jamming' },
      { name: 'Interference classification — CW, chirp, pulsed, spoofed', maturity: 'implemented', context: 'ML on spectral, temporal and statistical features' },
      { name: 'Spoofing detection', maturity: 'implemented', context: 'PRN correlation and signal-structure checks' },
      { name: 'RF captures, raw IQ & gain telemetry workflows', maturity: 'implemented', context: 'Evaluation and tuning of suppression' },
      { name: 'RF front-end chain — bias-T, LNA, band-pass', maturity: 'studied', context: 'Anti-jamming system architecture research' },
      { name: 'GNSS receiver architecture — acquisition, tracking, PVT', maturity: 'studied', context: 'Custom receiver research roadmap' },
    ],
  },
  {
    id: 'fpga',
    index: '04',
    title: 'FPGA & Embedded Systems',
    short: 'FPGA',
    summary:
      'Taking algorithms from NumPy to fixed-point streaming hardware, and designing the hardware–software boundary around them.',
    glyph: 'pipeline',
    items: [
      { name: 'Python algorithm simulation → fixed point', maturity: 'implemented', context: 'Beamforming and null steering' },
      { name: 'Vitis HLS & Vivado', maturity: 'implemented', context: 'High-level synthesis of DSP kernels' },
      { name: 'Xilinx RFSoC real-time DSP', maturity: 'deployed', context: 'Streaming matrix operations, covariance, adaptive weights' },
      { name: 'Hardware–software co-design', maturity: 'implemented', context: 'Multi-channel IQ processing' },
      { name: 'Kria KV260', maturity: 'implemented', context: 'Embedded AI and low-latency pipelines (per résumé)' },
      { name: 'Embedded interfaces — UART, SPI, I²C, CAN, JTAG', maturity: 'studied', context: 'System integration notes' },
    ],
  },
  {
    id: 'cv',
    index: '05',
    title: 'Computer Vision & Autonomy',
    short: 'Vision',
    summary:
      'Perception and state estimation for platforms that must know where they are — with or without satellites.',
    glyph: 'pointcloud',
    items: [
      { name: 'Visual localization pipeline', maturity: 'implemented', context: 'Retrieval, dense matching, geometric verification' },
      { name: 'DINOv2, RoMa, XFeat, FAISS, RANSAC', maturity: 'implemented', context: 'Robust correspondence under viewpoint change' },
      { name: 'Visual-inertial odometry — VINS-Fusion', maturity: 'implemented', context: 'Integrated on ROS 2 Humble' },
      { name: 'LiDAR-inertial odometry — FAST-LIO2', maturity: 'implemented', context: 'Integrated on ROS 2 Humble' },
      { name: 'Multi-sensor calibration & synchronization', maturity: 'implemented', context: 'LiDAR, stereo camera and IMU' },
      { name: 'INS/EKF navigation with barometer & DoA', maturity: 'simulated', context: 'UAV navigation simulation study' },
      { name: 'OpenCV, Gazebo, RViz2', maturity: 'implemented', context: 'Tooling' },
    ],
  },
  {
    id: 'sw',
    index: '06',
    title: 'Software Engineering',
    short: 'Software',
    summary:
      'Production services, reproducible pipelines and the unglamorous engineering that keeps models useful.',
    glyph: 'graph',
    items: [
      { name: 'Python, C/C++, SQL, Bash, JavaScript', maturity: 'implemented', context: 'Daily languages' },
      { name: 'FastAPI, Celery, Redis, PostgreSQL', maturity: 'deployed', context: 'Production document-extraction services' },
      { name: 'Document pipelines — PyPDF2, Tesseract, Pandas', maturity: 'deployed', context: 'OCR and ETL into database records' },
      { name: 'Three.js dashboards', maturity: 'implemented', context: 'Fleet RUL dashboards with a 3D engine view' },
      { name: 'Docker, Git, Linux', maturity: 'implemented', context: 'Development and deployment' },
      { name: 'DVC & MLflow pipelines', maturity: 'implemented', context: 'Personal end-to-end ML projects (public repos)' },
    ],
  },
]
