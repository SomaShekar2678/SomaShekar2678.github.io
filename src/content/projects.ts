import type { Project, ProjectStatus } from '../types/content'

export const STATUS_META: Record<ProjectStatus, { label: string; description: string; step: number }> = {
  research: {
    label: 'Research',
    description: 'Architecture and literature study. No implementation is claimed.',
    step: 1,
  },
  exploratory: {
    label: 'Exploratory analysis',
    description: 'Notebook-based analysis and modelling on a public dataset.',
    step: 2,
  },
  simulation: {
    label: 'Simulation',
    description: 'Algorithms implemented and evaluated on simulated data.',
    step: 2,
  },
  prototype: {
    label: 'Prototype',
    description: 'A working implementation evaluated during development.',
    step: 3,
  },
  'hardware-integration': {
    label: 'Hardware integration',
    description: 'Running on target hardware with real RF or sensor data.',
    step: 4,
  },
  'internal-delivery': {
    label: 'Internal delivery',
    description: 'Delivered to employer stakeholders. Not a public product.',
    step: 4,
  },
  validated: {
    label: 'Validated implementation',
    description: 'Performance verified against documented acceptance criteria.',
    step: 5,
  },
  production: {
    label: 'Production deployment',
    description: 'Running in production.',
    step: 6,
  },
}

const CONFIDENTIAL =
  'Employer project: source code, captures and quantitative field results are confidential and are not published here.'

export const projects: Project[] = [
  // ───────────────────────────────────────────────────────────── 01
  {
    slug: 'j-dome',
    index: '01',
    title: 'J-DOME',
    kicker: 'Adaptive spatial interference suppression for GNSS reception',
    summary:
      'A multi-antenna GNSS anti-jamming system: estimate where interference comes from, steer nulls toward it, keep gain toward the satellites — from Python simulation to a real-time pipeline on Xilinx RFSoC.',
    domains: ['Array signal processing', 'RF / GNSS', 'FPGA'],
    context: 'Professional · TAVAS Industries',
    period: '2025 – present',
    status: 'hardware-integration',
    statusNote:
      'Algorithms taken from Python simulation through fixed-point HLS to a real-time DSP pipeline on Xilinx RFSoC (per résumé). Field effectiveness is not claimed here.',
    featured: true,
    cover: 'beam',
    image: { name: 'j-dome', alt: 'Illustrative render: a seven-element circular antenna array under a white sculpture of its MVDR beam pattern, with two copper interferer markers on the horizon and nulls toward them.' },
    tone: 'cobalt',
    metrics: [
      { value: 'L1 → L1/L2/L5', label: 'Interference processing extended from single-band to multi-band', source: 'resume' },
      { value: 'RFSoC', label: 'Real-time streaming covariance and adaptive-weight processing', source: 'resume' },
      { value: '4 classes', label: 'Interference types classified: CW, chirp, pulsed, spoofed', source: 'resume' },
    ],
    caseStudy: {
      problem: [
        'GNSS signals reach the ground extremely weak — around −130 dBm, below the thermal noise floor. A low-power transmitter on the same band can therefore deny positioning across a wide area, and platforms that rely on GNSS lock lose navigation and timing.',
        'A controlled reception pattern antenna (CRPA) array offers a spatial answer: because the jammer and the satellites arrive from different directions, an adaptive array can place deep nulls toward interference while keeping useful gain toward the sky.',
      ],
      whyItMatters: [
        'Uninterrupted positioning, navigation and timing underpin UAVs, vehicles, maritime platforms and critical infrastructure. Resilience to interference is a capability gap that sits squarely between RF hardware, signal processing and real-time computing — which is exactly the intersection this project works in.',
      ],
      objectives: [
        'Estimate the angle of arrival of interference sources from multi-channel IQ data.',
        'Place adaptive spatial nulls toward jammers while preserving gain toward GNSS satellites.',
        'Detect and classify interference — continuous-wave, chirp, pulsed and spoofed signals.',
        'Extend processing from single-band L1 to multi-band L1/L2/L5.',
        'Run the adaptive processing in real time on Xilinx RFSoC.',
      ],
      constraints: [
        'Degrees of freedom: an M-element array can null at most M − 1 independent interferers.',
        'Element spacing near λ/2 (≈ 9.5 cm at L1, 1575.42 MHz) to keep channels decorrelated without grating lobes.',
        'Streaming, fixed-point arithmetic on FPGA fabric with a hard real-time budget.',
        'Satellites and jammers that arrive from nearly the same direction cannot be separated spatially.',
        'Size, weight and power limits on the host platform.',
      ],
      architecture: {
        caption: 'Signal chain and adaptive loop documented in the project research notebook.',
        stages: [
          { id: 'ant', label: 'CRPA antenna array', detail: 'Multi-element array; one RF channel per element', group: 'RF' },
          { id: 'afe', label: 'Analog front end', detail: 'Bias-T, low-noise amplification, band-pass filtering', group: 'RF' },
          { id: 'adc', label: 'Multi-channel digitisation', detail: 'Coherent ADC channels and down-conversion to IQ', group: 'Digital' },
          { id: 'det', label: 'Detection & classification', detail: 'Power thresholds, spectral shape, statistical and cyclostationary features, ML classifier', group: 'Digital' },
          { id: 'doa', label: 'Direction of arrival', detail: 'Covariance estimation, MUSIC / ESPRIT', group: 'Digital' },
          { id: 'bf', label: 'Adaptive weights & null steering', detail: 'MVDR / LCMV, LMS / RLS adaptation', group: 'Digital' },
          { id: 'rx', label: 'GNSS receiver', detail: 'Cleaned signal to a commercial multi-band receiver', group: 'Receiver' },
          { id: 'host', label: 'Host processor', detail: 'Position/time over UART–NMEA, jammer status, loop control', group: 'Host' },
        ],
        feedback: [{ from: 'host', to: 'bf', label: 'Classification feedback refines null parameters' }],
        note: 'Stages are shown only where they appear in the project design notes. Calibration and temporal filtering stages are not shown because they are not documented in the supplied material.',
      },
      methods: [
        {
          name: 'Sample covariance',
          detail: 'Spatial covariance of the array snapshot vectors — the input to every adaptive method below.',
          maturity: 'deployed',
          equation: 'R̂ = (1/N) Σₙ x[n] x[n]ᴴ',
        },
        {
          name: 'MUSIC',
          detail: 'Super-resolution direction finding from the noise subspace of R̂.',
          maturity: 'implemented',
          equation: 'P(θ) = 1 / ( a(θ)ᴴ Eₙ Eₙᴴ a(θ) )',
        },
        {
          name: 'ESPRIT',
          detail: 'Direction estimates from rotational invariance between sub-arrays; no spectral search.',
          maturity: 'implemented',
        },
        {
          name: 'MVDR (Capon)',
          detail: 'Minimise output power while keeping unit gain toward the desired direction — nulls form automatically toward strong interference.',
          maturity: 'implemented',
          equation: 'w = R⁻¹a / ( aᴴ R⁻¹ a )',
        },
        {
          name: 'LCMV',
          detail: 'Generalises MVDR with multiple linear constraints, e.g. unit gain toward the satellite and zero toward a known jammer.',
          maturity: 'implemented',
          equation: 'w = R⁻¹C ( Cᴴ R⁻¹ C )⁻¹ f',
        },
        {
          name: 'LMS / RLS adaptation',
          detail: 'Iterative weight updates — LMS by stochastic gradient, RLS with an exponentially weighted memory (forgetting factor λ).',
          maturity: 'implemented',
          equation: 'w[n+1] = w[n] + μ x[n] e*[n]',
        },
        {
          name: 'Interference features',
          detail: 'Kurtosis, crest factor, spectral flatness, occupied bandwidth, autocorrelation ratio, spectral entropy and cyclostationary features feed the classifier.',
          maturity: 'implemented',
        },
        {
          name: 'EKF angle tracking',
          detail: 'Replacing single-snapshot ESPRIT with an extended Kalman filter per tracked source to follow moving jammers across snapshots.',
          maturity: 'simulated',
        },
      ],
      stack: [
        { group: 'Simulation', items: ['Python', 'NumPy', 'SciPy', 'scikit-learn'] },
        { group: 'Hardware', items: ['Xilinx RFSoC', 'Vivado', 'Vitis HLS', 'Fixed-point arithmetic'] },
        { group: 'Data', items: ['RF captures', 'Raw IQ samples', 'Gain telemetry', 'Navigation feedback'] },
      ],
      contribution: [
        'Designed the software architecture: AoA/DoA estimation, adaptive beamforming, spatial filtering, null steering and jammer localization on multi-channel IQ data.',
        'Implemented the array-processing algorithms: covariance estimation, MUSIC/ESPRIT, MVDR/LCMV, LMS/RLS and spatial null steering for CRPA arrays.',
        'Built ML-based RF interference classification and FFT, cyclostationary and PRN-correlation analysis for interference and spoofing detection.',
        'Built evaluation and tuning workflows from RF captures, raw IQ samples, gain telemetry and navigation-system feedback.',
        'Deployed real-time DSP on Xilinx RFSoC with streaming matrix operations, covariance computation and adaptive-weight processing.',
      ],
      implementation: [
        'Simulation first: synthetic GPS C/A signals (1023-chip Gold codes repeated to the required length), CW tones, chirps, pulsed jammers and Gaussian noise at controlled SNR and jammer power, received by a modelled array geometry.',
        'Algorithms were compared in simulation — conventional beam scanning, FFT beam scanning, MUSIC and ESPRIT for direction finding; MVDR, LCMV and LMS/RLS for suppression — before fixed-point implementation.',
        'The real-time path was implemented with Vitis HLS as streaming kernels for covariance computation and adaptive-weight processing on RFSoC.',
        'A closed loop was designed in which initial nulling keeps the receiver operational first, and classification output then refines null parameters ("survive first, optimise later").',
      ],
      validation: [
        'Suppression was evaluated and tuned using RF captures, raw IQ samples, gain telemetry and navigation-system feedback (per résumé).',
        'Quantitative suppression figures, latency measurements and field-test results are not published on this site.',
      ],
      results: [
        'Interference detection and suppression extended from single-band L1 to multi-band L1/L2/L5.',
        'Adaptive beamforming and null-steering algorithms implemented in fixed point and integrated into a real-time RFSoC pipeline.',
        'Interference classification separating continuous-wave, chirp, pulsed and spoofed signals.',
      ],
      limitations: [
        'No publicly reportable field-test data; effectiveness against specific threat scenarios is not claimed.',
        'Spatial nulling cannot separate a jammer that is nearly co-located in angle with a satellite.',
        'The number of simultaneous nulls is bounded by the number of elements.',
      ],
      nextSteps: [
        'EKF-based tracking of moving jammers across snapshots (prototyped in simulation).',
        'Joint azimuth–elevation (2D) direction finding over a hemispherical search grid.',
        'Space–time adaptive processing for Doppler-shifted and fast-moving interference.',
      ],
      artifacts: [
        { label: 'Interactive beamforming lab', href: '#lab', note: 'Explore MVDR / LCMV nulling on this site (illustrative model).' },
        { label: 'Source code', note: CONFIDENTIAL },
      ],
    },
    evidence: [
      { source: 'resume', note: 'Experience bullets and key results, identical across all tailored résumés.' },
      { source: 'notes', note: 'GNSS anti-jamming research notebook (67 pages): architecture, algorithms, simulation plan.' },
    ],
    missing: [
      'Public-safe diagram or photo of the hardware set-up (if cleared by the employer).',
      'Cleared quantitative results (e.g. suppression depth, latency) — only if they can be shared.',
    ],
    links: [],
  },

  // ───────────────────────────────────────────────────────────── 02
  {
    slug: 'visual-localization',
    index: '02',
    title: 'Visual Localization',
    kicker: 'A GNSS-independent position source from imagery',
    summary:
      'An end-to-end visual localization pipeline — global retrieval, dense matching and geometric verification — restructured to cut end-to-end latency from 22 s to 1 s.',
    domains: ['Computer vision', 'Navigation'],
    context: 'Professional · TAVAS Industries',
    period: '2025 – present',
    status: 'prototype',
    statusNote: 'End-to-end pipeline built and latency measured (per résumé). Localization accuracy figures are not published.',
    featured: true,
    cover: 'matching',
    image: { name: 'visual-localization', alt: 'Illustrative render: a camera above contour-lined terrain, with blue rays to matched ground features and a dashed flight path.' },
    tone: 'sage',
    metrics: [
      { value: '22 s → 1 s', label: 'End-to-end localization latency (~20×)', source: 'resume' },
    ],
    caseStudy: {
      problem: [
        'When GNSS is degraded or denied, a platform needs another way to know where it is. Matching what the camera sees against reference imagery provides an absolute position fix that does not depend on satellites.',
        'The difficulty is robustness and speed: viewpoint and appearance change between query and reference images, and a fix that takes tens of seconds is of little use to a moving platform.',
      ],
      whyItMatters: [
        'A visual fix complements inertial navigation, which drifts without correction. Together with GNSS anti-jamming, it forms a second line of defence for resilient navigation.',
      ],
      objectives: [
        'Produce a position estimate from a single query image against a reference database.',
        'Stay robust to viewpoint and appearance change.',
        'Accept a pose only when confidence is high enough to be trusted downstream.',
        'Reduce end-to-end latency enough to be useful on a moving platform.',
      ],
      constraints: [
        'Real-time budget on a moving platform.',
        'Large reference database: exhaustive dense matching against every candidate is too slow.',
        'Appearance change between capture times.',
      ],
      architecture: {
        caption: 'Stages listed in the résumé description of the pipeline.',
        stages: [
          { id: 'q', label: 'Query image', detail: 'Onboard camera frame', group: 'Input' },
          { id: 'feat', label: 'Feature extraction', detail: 'Global descriptors (DINOv2)', group: 'Retrieval' },
          { id: 'ret', label: 'Image retrieval', detail: 'Nearest-neighbour search with FAISS', group: 'Retrieval' },
          { id: 'pre', label: 'Candidate pre-filtering', detail: 'Prune candidates before expensive matching', group: 'Retrieval' },
          { id: 'match', label: 'Dense matching', detail: 'RoMa correspondences', group: 'Matching' },
          { id: 'geo', label: 'Geometric verification', detail: 'RANSAC model fitting and inlier checks', group: 'Matching' },
          { id: 'acc', label: 'Pose acceptance', detail: 'Confidence-based accept / reject', group: 'Output' },
        ],
      },
      methods: [
        { name: 'Global retrieval', detail: 'Self-supervised DINOv2 embeddings indexed with FAISS for fast candidate search.', maturity: 'implemented' },
        { name: 'Dense matching', detail: 'RoMa dense correspondences for robustness to viewpoint and appearance change; XFeat for lightweight features.', maturity: 'implemented' },
        { name: 'Geometric verification', detail: 'RANSAC rejects outlier correspondences and inconsistent candidates.', maturity: 'implemented' },
        { name: 'Confidence gating', detail: 'Only poses passing confidence criteria are accepted.', maturity: 'implemented' },
      ],
      stack: [
        { group: 'Models', items: ['DINOv2', 'RoMa', 'XFeat'] },
        { group: 'Libraries', items: ['PyTorch', 'OpenCV', 'FAISS'] },
        { group: 'Platform', items: ['Python', 'ROS 2'] },
      ],
      contribution: [
        'Architected the end-to-end pipeline: feature extraction, image retrieval, dense matching, geometric verification and confidence-based pose acceptance.',
        'Reduced end-to-end latency from 22 s to 1 s through pipeline restructuring, candidate pre-filtering and computational optimisation.',
      ],
      implementation: [
        'Retrieval narrows the search to a short list of candidates before any dense matching happens.',
        'Pre-filtering removes unpromising candidates early, so the expensive dense matcher runs on far fewer image pairs.',
        'Geometric verification and confidence gating turn raw correspondences into an accept / reject decision.',
      ],
      validation: ['End-to-end latency measured before and after optimisation: 22 s → 1 s (per résumé).'],
      results: ['~20× lower end-to-end latency with the same pipeline stages.'],
      limitations: [
        'Accuracy and recall figures are not published here.',
        'Performance depends on the coverage and freshness of the reference imagery.',
      ],
      nextSteps: ['Fusing accepted visual fixes into the EKF/ESKF navigation filter as absolute position updates.'],
      artifacts: [{ label: 'Source code', note: CONFIDENTIAL }],
    },
    evidence: [{ source: 'resume', note: 'Computer vision & real-time visual localization bullets.' }],
    missing: ['Public-safe example imagery or a schematic of matched correspondences, if cleared.'],
    links: [],
  },

  // ───────────────────────────────────────────────────────────── 03
  {
    slug: 'engine-prognostics',
    index: '03',
    title: 'Engine Prognostics',
    kicker: 'Health scoring and remaining-useful-life estimation for a diesel engine fleet',
    summary:
      'An end-to-end prognostics and health-management pipeline that fuses 1 Hz test-bench telemetry, oil analysis, inspections and teardown records into per-engine health, failure-mode and RUL outputs with 80% confidence intervals.',
    domains: ['Machine learning', 'Statistics', 'Reliability'],
    context: 'Professional · TAVAS Industries',
    period: '2025 – present',
    status: 'internal-delivery',
    statusNote: 'RUL estimates and fleet dashboards delivered internally (per résumé).',
    featured: true,
    cover: 'survival',
    image: { name: 'engine-prognostics', alt: 'Illustrative render: a row of standing survival curves for an engine fleet, one highlighted in black with a blue 80% interval band.' },
    tone: 'copper',
    metrics: [
      { value: '80% CI', label: 'Remaining-useful-life estimates delivered with confidence intervals', source: 'resume' },
      { value: '0 – 100', label: 'Engine health score with Green / Amber / Red classes', source: 'resume' },
    ],
    caseStudy: {
      problem: [
        'Engine health is spread across very different records — continuous bench telemetry, stage sheets, oil analysis, in-service checks and teardown findings. None of them alone says how much life an engine has left.',
        'The data is also imperfect: sensors fault, and manual records can hide problems such as undeclared oil or coolant top-ups.',
      ],
      whyItMatters: [
        'Maintenance planned on evidence rather than fixed intervals reduces unexpected failures and avoidable overhauls. A credible RUL estimate needs uncertainty attached — a single number invites false confidence.',
      ],
      objectives: [
        'Fuse heterogeneous engine records into a per-engine health view.',
        'Separate sensor faults from genuine engine faults.',
        'Attribute symptoms to likely failure modes.',
        'Estimate remaining useful life with honest uncertainty.',
      ],
      constraints: [
        'Small fleets and censored lifetimes: many engines have not failed yet.',
        'Leakage risk when the same engine appears in both training and evaluation folds.',
        'Operating conditions (RPM, load, temperature) vary between tests.',
      ],
      architecture: {
        caption: 'Pipeline stages as described in the résumé.',
        stages: [
          { id: 'src', label: 'Data fusion', detail: '1 Hz telemetry, stage sheets, oil analysis, in-service checks, teardown records', group: 'Data' },
          { id: 'int', label: 'Data-integrity rules', detail: 'Cross-check stage sheets against sensors to catch concealed faults', group: 'Data' },
          { id: 'nbm', label: 'Normal-behaviour models', detail: 'Regularised regression on RPM, load and temperatures → residual health indicators', group: 'Health' },
          { id: 'anom', label: 'Layered anomaly detection', detail: 'Engineering limits + Isolation Forest + change-point detection', group: 'Health' },
          { id: 'score', label: 'Health score & failure modes', detail: '0–100 score, G/A/R classes; physics rules + gradient-boosted classifier', group: 'Health' },
          { id: 'rul', label: 'RUL estimation', detail: 'Kaplan–Meier, censored Weibull, Weibull AFT, Bayesian mixed-effects', group: 'Prognosis' },
          { id: 'dash', label: 'Fleet dashboards', detail: 'Per-engine drill-down, 3D engine view (Three.js)', group: 'Delivery' },
        ],
      },
      methods: [
        { name: 'Normal-behaviour modelling', detail: 'Regularised regression predicts expected readings from operating conditions; residuals become condition-normalised health indicators.', maturity: 'implemented' },
        { name: 'Isolation Forest & change-point detection', detail: 'Layered with engineering limits so sensor faults are separated from engine faults.', maturity: 'implemented' },
        { name: 'Hybrid failure-mode classifier', detail: 'Physics rules combined with a gradient-boosted classifier, evaluated with engine-grouped cross-validation.', maturity: 'implemented' },
        { name: 'Survival analysis', detail: 'Kaplan–Meier, censored Weibull and Weibull accelerated-failure-time models handle engines that have not yet failed.', maturity: 'implemented', equation: 'S(t) = exp( −(t/η)^β )' },
        { name: 'Bayesian mixed-effects degradation', detail: 'Population-level trends with engine-level random effects, updated as new evidence arrives.', maturity: 'implemented' },
      ],
      stack: [
        { group: 'Modelling', items: ['Python', 'scikit-learn', 'statsmodels', 'SciPy', 'Gradient boosting'] },
        { group: 'Data', items: ['Pandas', 'SQL'] },
        { group: 'Delivery', items: ['Three.js', 'Interactive dashboards'] },
      ],
      contribution: [
        'Architected the end-to-end PHM pipeline.',
        'Developed normal-behaviour models, the layered anomaly detector and data-integrity rules that catch concealed bench-test faults (undeclared top-ups, shortened stages, copied readings).',
        'Built the 0–100 Engine Health Score with symptom-based failure-mode attribution.',
        'Estimated RUL with survival and Bayesian mixed-effects models, delivering 80% confidence intervals.',
        'Delivered fleet RUL dashboards with per-engine drill-down and a Three.js engine view driven by a mean-value engine and cylinder-pressure model.',
      ],
      implementation: [
        'Integrity rules run first, so later models are not trained on records that contradict the sensor data.',
        'Health indicators are residuals against expected behaviour, which normalises away operating-condition differences between tests.',
        'Engine-grouped cross-validation keeps every engine entirely in either the training or the evaluation fold.',
      ],
      validation: [
        'Classifier evaluated with engine-grouped cross-validation (per résumé).',
        'Model accuracy figures, sample counts and fleet size are not published here.',
      ],
      results: [
        'Per-engine health scores, failure-mode attribution and RUL with 80% confidence intervals delivered through interactive dashboards.',
      ],
      limitations: [
        'Survival estimates are only as good as the number of observed failures; wide intervals are expected for small fleets.',
        'Quantitative evaluation results are confidential.',
      ],
      nextSteps: ['Owner to add — next phase of the prognostics work.'],
      artifacts: [{ label: 'Source code & data', note: CONFIDENTIAL }],
    },
    evidence: [{ source: 'resume', note: 'Predictive maintenance & engine health monitoring bullets.' }],
    missing: [
      'The RUL / degradation notebook referenced in the brief was not among the supplied files — results from it are therefore not shown.',
      'Next steps for this workstream.',
    ],
    links: [],
  },

  // ───────────────────────────────────────────────────────────── 04
  {
    slug: 'perception-state-estimation',
    index: '04',
    title: 'Perception & State Estimation',
    kicker: 'Multi-sensor fusion for autonomous platforms',
    summary:
      'EKF/ESKF fusion of IMU, stereo vision and GNSS for real-time 6-DoF pose, VINS-Fusion and FAST-LIO2 integrated on ROS 2 Humble — plus a UAV navigation simulation that corrects INS drift with barometer and RF direction-of-arrival measurements.',
    domains: ['Robotics', 'Sensor fusion', 'Navigation'],
    context: 'Professional · TAVAS Industries + simulation study',
    period: '2025 – present',
    status: 'prototype',
    statusNote:
      'Fusion pipelines developed and odometry stacks integrated on ROS 2 Humble (per résumé). The UAV navigation study is a simulation. No deployed-product claim.',
    featured: true,
    cover: 'trajectory',
    image: { name: 'perception-state-estimation', alt: 'Illustrative render: a LiDAR-style point cloud of a corridor with doorways, an estimated trajectory as a blue tube and green covariance ellipsoids that grow along it.' },
    tone: 'night',
    metrics: [{ value: '6-DoF', label: 'Real-time pose from IMU, stereo vision and GNSS', source: 'resume' }],
    caseStudy: {
      problem: [
        'Every sensor fails in its own way: IMUs drift, cameras lose texture, LiDAR degenerates in feature-poor scenes and GNSS can be jammed. An autonomous platform needs a state estimate that stays consistent when any one of them degrades.',
      ],
      whyItMatters: [
        'State estimation is the foundation for control, mapping and planning. In GNSS-contested environments it is also the difference between a platform that continues its mission and one that does not.',
      ],
      objectives: [
        'Real-time 6-DoF pose from complementary sensors.',
        'Robust odometry from visual-inertial and LiDAR-inertial pipelines.',
        'Accurate time synchronization and extrinsic calibration between sensors.',
        'Understand drift behaviour when GNSS is unavailable (simulation study).',
      ],
      constraints: [
        'Sensors run at different rates and clocks.',
        'Calibration errors propagate directly into pose error.',
        'Compute budget on embedded platforms.',
      ],
      architecture: {
        caption: 'Fusion pipeline (per résumé) and the simulation study flow (research notes).',
        stages: [
          { id: 'sens', label: 'Sensors', detail: 'Stereo camera, IMU, LiDAR, GNSS', group: 'Input' },
          { id: 'sync', label: 'Sync & calibration', detail: 'Time alignment and extrinsics for LiDAR, stereo, IMU', group: 'Input' },
          { id: 'vio', label: 'VIO / LIO', detail: 'VINS-Fusion and FAST-LIO2 on ROS 2 Humble', group: 'Odometry' },
          { id: 'ekf', label: 'EKF / ESKF fusion', detail: 'Error-state filtering of IMU, vision and GNSS', group: 'Fusion' },
          { id: 'pose', label: '6-DoF pose', detail: 'Real-time state for localization and mapping', group: 'Output' },
        ],
      },
      methods: [
        { name: 'Error-state Kalman filter', detail: 'Propagates the nominal state with the IMU and estimates a small error state, which keeps linearisation well behaved for attitude.', maturity: 'implemented' },
        { name: 'Visual-inertial odometry', detail: 'VINS-Fusion integrated on ROS 2 Humble.', maturity: 'implemented' },
        { name: 'LiDAR-inertial odometry', detail: 'FAST-LIO2 integrated on ROS 2 Humble.', maturity: 'implemented' },
        {
          name: 'UAV INS/EKF simulation',
          detail: 'Simulated 6-DoF trajectory → noisy IMU, magnetometer, barometer and RF DoA → INS dead reckoning → EKF corrections from barometer and DoA → RMSE of position and attitude against truth.',
          maturity: 'simulated',
          equation: 'x̂⁻ = f(x̂), P⁻ = F P Fᵀ + Q',
        },
      ],
      stack: [
        { group: 'Robotics', items: ['ROS 2 Humble', 'VINS-Fusion', 'FAST-LIO2', 'Gazebo', 'RViz2'] },
        { group: 'Estimation', items: ['EKF', 'ESKF', 'Python', 'C++'] },
        { group: 'Sensors', items: ['Stereo camera', 'IMU', 'LiDAR', 'GNSS'] },
      ],
      contribution: [
        'Developed multi-sensor fusion pipelines integrating IMU, stereo vision and GNSS using EKF and ESKF state estimation for real-time 6-DoF pose.',
        'Integrated VINS-Fusion and FAST-LIO2 on ROS 2 Humble for localization and mapping.',
        'Built multi-sensor synchronization and calibration workflows aligning LiDAR, stereo-camera and IMU streams.',
        'Designed a UAV navigation simulation to study INS drift correction with barometer and DoA measurements.',
      ],
      implementation: [
        'In the simulation, a trajectory generator produces true position, attitude and rates; sensor models add Gaussian noise; the INS integrates IMU data as the prior; and the EKF corrects it with barometer and DoA updates before RMSE evaluation.',
      ],
      validation: [
        'Simulation study evaluated with position and attitude RMSE against the generated ground truth.',
        'Quantitative results from the integrated platform are not published here.',
      ],
      results: ['Real-time 6-DoF pose estimation pipeline and integrated VIO/LIO odometry on ROS 2 Humble (per résumé).'],
      limitations: [
        'No public benchmark results (e.g. on standard datasets) are reported.',
        'The UAV study uses simulated sensors and does not model every real-world error source.',
      ],
      nextSteps: ['Using visual-localization fixes as absolute updates in the fusion filter during GNSS outages.'],
      artifacts: [{ label: 'Source code', note: CONFIDENTIAL }],
    },
    evidence: [
      { source: 'resume', note: 'Robotics, navigation & sensor fusion bullets.' },
      { source: 'notes', note: 'UAV navigation system simulation design (INS + EKF with barometer and DoA).' },
    ],
    missing: ['Benchmark or dataset results, if any public evaluation exists.'],
    links: [],
  },

  // ───────────────────────────────────────────────────────────── 05
  {
    slug: 'gnss-receiver-research',
    index: '05',
    title: 'GNSS Receiver Research',
    kicker: 'Towards a custom software-defined receiver',
    summary:
      'A research roadmap for an end-to-end GNSS receiver: front end, acquisition, tracking, navigation data, PVT and integrity monitoring — and where hardware acceleration fits. This is a research programme, not a finished receiver.',
    domains: ['GNSS', 'Signal processing', 'Research'],
    context: 'Research · self-directed and work-adjacent',
    period: '2025 – present',
    status: 'research',
    statusNote: 'Architecture and literature study. PRN correlation is implemented within the anti-jamming work; the other stages are planned.',
    featured: true,
    cover: 'correlation',
    image: { name: 'gnss-receiver-research', alt: 'Illustrative render: the 1023 chips of the GPS C/A code for PRN 1 as a ring of bars, with its autocorrelation on an inner ring and a single copper spike at zero lag.' },
    tone: 'paper',
    metrics: [],
    caseStudy: {
      problem: [
        'Commercial receivers are black boxes. Anti-jamming, spoofing detection and integrity monitoring all improve when you control the acquisition and tracking loops and can observe correlator outputs directly.',
      ],
      whyItMatters: [
        'A receiver that can be inspected and modified end to end is the foundation for resilient positioning and timing — and for domestic capability in navigation technology.',
      ],
      objectives: [
        'Map the receiver architecture end to end and identify what must be built versus reused.',
        'Reuse PRN-correlation work from interference and spoofing detection.',
        'Identify which stages benefit from FPGA acceleration.',
      ],
      constraints: ['Signals below the noise floor require long coherent integration.', 'Tracking loops must survive platform dynamics.'],
      architecture: {
        caption: 'Planned receiver architecture. Stage labels show what exists today.',
        stages: [
          { id: 'fe', label: 'RF front end & sampling', detail: 'LNA, filtering, down-conversion, ADC', group: 'RF', state: 'studied' },
          { id: 'acq', label: 'Acquisition', detail: '2D search over code phase × Doppler', group: 'Baseband', state: 'planned' },
          { id: 'corr', label: 'PRN correlation', detail: 'C/A Gold-code correlation (used for interference & spoofing detection)', group: 'Baseband', state: 'implemented' },
          { id: 'trk', label: 'Tracking', detail: 'Code (DLL) and carrier (PLL / FLL) loops', group: 'Baseband', state: 'planned' },
          { id: 'nav', label: 'Navigation data', detail: 'Bit sync, frame decoding, ephemeris', group: 'Navigation', state: 'planned' },
          { id: 'pvt', label: 'PVT', detail: 'Least-squares / Kalman position, velocity, time', group: 'Navigation', state: 'planned' },
          { id: 'raim', label: 'Integrity monitoring', detail: 'RAIM and signal-quality monitoring', group: 'Navigation', state: 'studied' },
        ],
        note: 'Stage states: “implemented” reflects related professional work; “studied” and “planned” are not implemented receiver stages.',
      },
      methods: [
        { name: 'C/A code correlation', detail: '1023-chip Gold codes repeating every 1 ms; sharp autocorrelation peak at zero lag.', maturity: 'implemented', equation: 'R(τ) = Σₙ x[n] c[n − τ]' },
        { name: 'Autocorrelation ratio as a feature', detail: 'Highly structured GNSS-like signals show a high peak-to-off-peak autocorrelation ratio; CW and noise do not.', maturity: 'implemented' },
        { name: 'Acquisition & tracking loops', detail: 'Serial / FFT-based parallel code-phase search; DLL / PLL / FLL tracking.', maturity: 'studied' },
        { name: 'RAIM', detail: 'Receiver autonomous integrity monitoring of the position solution under residual interference.', maturity: 'studied' },
      ],
      stack: [{ group: 'Planned', items: ['Python', 'NumPy', 'Recorded IQ', 'FPGA correlators (exploratory)'] }],
      contribution: ['Research and architecture mapping; PRN-correlation tooling reused from the anti-jamming work.'],
      implementation: ['Not yet implemented beyond correlation tooling. This page will document progress as stages are built.'],
      validation: ['None yet — no receiver performance is claimed.'],
      results: ['A documented architecture and roadmap.'],
      limitations: ['Research stage. No acquisition, tracking or PVT implementation is claimed.'],
      nextSteps: [
        'Acquisition on recorded IQ data.',
        'Code and carrier tracking loops.',
        'Navigation-message decoding and a least-squares PVT solution.',
        'Assess FPGA acceleration of correlators.',
      ],
      artifacts: [{ label: 'Repository', note: 'To be published when the first stages are implemented.' }],
    },
    evidence: [
      { source: 'notes', note: 'C/A code, autocorrelation features, RAIM and receiver comparison notes in the research notebook.' },
      { source: 'resume', note: 'PRN correlation for GNSS interference and spoofing detection.' },
    ],
    missing: ['Design documents or code for any receiver stages that already exist.'],
    links: [],
  },

  // ───────────────────────────────────────────────────────────── 06
  {
    slug: 'medical-rag-chatbot',
    index: '06',
    title: 'Medical RAG Chatbot',
    kicker: 'Retrieval-augmented question answering with Llama 2',
    summary:
      'A Flask chatbot that answers questions from a medical reference book: PDF chunks are embedded with sentence-transformers, stored in Pinecone and retrieved as context for a locally run, quantised Llama 2 7B chat model.',
    domains: ['Generative AI', 'NLP'],
    context: 'Independent project',
    period: '2025',
    status: 'prototype',
    statusNote: 'Working local application in a public repository. Educational project — not a medical device and not for clinical use.',
    featured: false,
    cover: 'rag',
    metrics: [],
    caseStudy: {
      problem: [
        'General-purpose LLMs answer confidently but without grounding. Retrieval-augmented generation constrains answers to a known reference text.',
      ],
      whyItMatters: ['A small, inspectable RAG system is a practical way to understand chunking, embedding and retrieval trade-offs.'],
      objectives: ['Index a medical reference PDF.', 'Retrieve relevant passages per question.', 'Generate answers with a local LLM in a web chat interface.'],
      constraints: ['Run the model locally on CPU (quantised GGML weights).'],
      architecture: {
        caption: 'From the repository structure.',
        stages: [
          { id: 'pdf', label: 'PDF loading', detail: 'PyPDF loader over the data folder', group: 'Index' },
          { id: 'chunk', label: 'Text splitting', detail: 'Chunked passages', group: 'Index' },
          { id: 'emb', label: 'Embeddings', detail: 'Hugging Face sentence-transformers', group: 'Index' },
          { id: 'vec', label: 'Vector store', detail: 'Pinecone index', group: 'Index' },
          { id: 'llm', label: 'Generation', detail: 'Llama 2 7B chat (GGML q4) via ctransformers + LangChain', group: 'Serve' },
          { id: 'ui', label: 'Web chat', detail: 'Flask app with HTML templates', group: 'Serve' },
        ],
      },
      methods: [
        { name: 'Dense retrieval', detail: 'Sentence-transformer embeddings with nearest-neighbour search in Pinecone.', maturity: 'implemented' },
        { name: 'Prompted generation', detail: 'Retrieved passages injected into a prompt template for Llama 2.', maturity: 'implemented' },
      ],
      stack: [{ group: 'Stack', items: ['Python', 'LangChain', 'Pinecone', 'sentence-transformers', 'ctransformers', 'Llama 2', 'Flask'] }],
      contribution: ['Sole author of the public repository.'],
      implementation: ['Separate indexing script (store_index.py) and serving app (app.py); prompt logic in src/prompt.py.'],
      validation: ['No formal evaluation is reported in the repository.'],
      results: ['A working local RAG chat application.'],
      limitations: ['Not evaluated for factual accuracy; not for medical advice.'],
      nextSteps: ['Owner to add.'],
      artifacts: [{ label: 'GitHub repository', href: 'https://github.com/SomaShekar2678/Medical-Chatbot-using-Llama2', note: 'Public repository' }],
    },
    evidence: [{ source: 'repository', note: 'README, requirements.txt and store_index.py in the public repository.' }],
    missing: [],
    links: [{ label: 'Repository', href: 'https://github.com/SomaShekar2678/Medical-Chatbot-using-Llama2', note: 'GitHub' }],
  },

  // ───────────────────────────────────────────────────────────── 07
  {
    slug: 'movielens-recommender',
    index: '07',
    title: 'Movie Recommender',
    kicker: 'Rating prediction on MovieLens',
    summary:
      'Rating prediction for 9,000 movies from 100,000 ratings by 600 users, exploring matrix factorisation (SVD) and neural collaborative filtering, evaluated with RMSE and MAE.',
    domains: ['Machine learning', 'Recommender systems'],
    context: 'Independent project',
    period: '2024',
    status: 'exploratory',
    statusNote: 'Notebook analysis on the public MovieLens dataset.',
    featured: false,
    cover: 'factorization',
    metrics: [],
    caseStudy: {
      problem: ['Predict ratings users would give to movies they have not yet rated.'],
      whyItMatters: ['Recommendation is a core personalisation problem in streaming and e-commerce.'],
      objectives: ['Clean and split the ratings data.', 'Compare factorisation and neural approaches.', 'Evaluate with RMSE and MAE.'],
      constraints: ['Sparse user–item matrix.'],
      architecture: {
        caption: 'Notebook workflow (from the repository README).',
        stages: [
          { id: 'data', label: 'MovieLens data', detail: 'Ratings, tags, movies, links', group: 'Data' },
          { id: 'prep', label: 'Pre-processing', detail: 'Missing values, encoding, train/test split', group: 'Data' },
          { id: 'mf', label: 'Models', detail: 'SVD matrix factorisation; neural collaborative filtering', group: 'Model' },
          { id: 'eval', label: 'Evaluation', detail: 'RMSE, MAE', group: 'Model' },
        ],
      },
      methods: [{ name: 'Matrix factorisation (SVD)', detail: 'Latent user and item factors.', maturity: 'implemented', equation: 'r̂ᵤᵢ = μ + bᵤ + bᵢ + pᵤᵀ qᵢ' }],
      stack: [{ group: 'Stack', items: ['Python', 'Jupyter', 'Pandas'] }],
      contribution: ['Sole author.'],
      implementation: ['Single notebook with the dataset files committed alongside.'],
      validation: ['RMSE and MAE on a held-out split (values not restated here).'],
      results: ['See the repository notebook.'],
      limitations: ['Small public dataset; no online evaluation.'],
      nextSteps: ['Hybrid collaborative + content-based models (noted in the README).'],
      artifacts: [{ label: 'GitHub repository', href: 'https://github.com/SomaShekar2678/Recommender_System', note: 'Public repository' }],
    },
    evidence: [{ source: 'repository', note: 'README and notebook in the public repository.' }],
    missing: [],
    links: [{ label: 'Repository', href: 'https://github.com/SomaShekar2678/Recommender_System', note: 'GitHub' }],
  },

  // ───────────────────────────────────────────────────────────── 08
  {
    slug: 'retail-forecasting',
    index: '08',
    title: 'Retail Sales Forecasting',
    kicker: '12-week store-level forecasts with Prophet',
    summary:
      'Store-level weekly sales analysis and 12-week forecasting on the Walmart dataset (6,435 rows), modelling holiday and seasonal effects with Prophet and time-series cross-validation.',
    domains: ['Time series', 'Forecasting'],
    context: 'Independent project',
    period: '2024',
    status: 'exploratory',
    statusNote: 'Notebook analysis on a public dataset.',
    featured: false,
    cover: 'seasonal',
    metrics: [],
    caseStudy: {
      problem: ['A multi-outlet retailer needs demand forecasts to match inventory to sales.'],
      whyItMatters: ['Forecast quality drives stocking, merchandising and staffing decisions.'],
      objectives: ['Derive store-level insights.', 'Forecast weekly sales 12 weeks ahead for each store.'],
      constraints: ['Strong holiday effects and outliers.'],
      architecture: {
        caption: 'Notebook workflow (from the repository README).',
        stages: [
          { id: 'data', label: 'Weekly sales', detail: 'Store, holiday flag, temperature, fuel price, CPI, unemployment', group: 'Data' },
          { id: 'prep', label: 'Pre-processing', detail: 'Date parsing, normalisation, outlier handling', group: 'Data' },
          { id: 'model', label: 'Prophet', detail: 'Trend + seasonality + holiday effects', group: 'Model' },
          { id: 'eval', label: 'Evaluation', detail: 'Time-series cross-validation, MAE, RMSE', group: 'Model' },
        ],
      },
      methods: [{ name: 'Prophet', detail: 'Additive trend, seasonality and holiday components.', maturity: 'implemented', equation: 'y(t) = g(t) + s(t) + h(t) + ε' }],
      stack: [{ group: 'Stack', items: ['Python', 'Prophet', 'Pandas', 'Jupyter'] }],
      contribution: ['Sole author.'],
      implementation: ['Exploratory analysis followed by per-store Prophet models.'],
      validation: ['Time-series cross-validation with MAE and RMSE (values not restated here).'],
      results: ['Holiday seasonality identified as a major driver; December growth ahead of Christmas exceeded the Thanksgiving spike (per README).'],
      limitations: ['No promotional or competitor data.'],
      nextSteps: ['Additional external regressors (noted in the README).'],
      artifacts: [{ label: 'GitHub repository', href: 'https://github.com/SomaShekar2678/Retail_Analysis_Walmart', note: 'Public repository' }],
    },
    evidence: [{ source: 'repository', note: 'README and notebook in the public repository.' }],
    missing: [],
    links: [{ label: 'Repository', href: 'https://github.com/SomaShekar2678/Retail_Analysis_Walmart', note: 'GitHub' }],
  },
]

export const featuredProjects = projects.filter((p) => p.featured)
export const otherProjects = projects.filter((p) => !p.featured)

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug)
}
