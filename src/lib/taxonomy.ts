// ============================================================
// JEE Practice Hub — Controlled Syllabus Taxonomy (2019–2026)
// ============================================================
// Strictly controlled taxonomy per Phase 4 master requirements.
// Models & extraction pipelines cannot invent chapters or topics.

export interface TopicDef {
  name: string;
  subtopics?: string[];
}

export interface ChapterDef {
  name: string;
  topics: string[];
  rationalizedIn2024?: boolean; // Tag for topics omitted in 2024+
  era?: 'pre-2024' | 'all';
}

export interface SubjectDef {
  name: 'Physics' | 'Chemistry' | 'Mathematics';
  chapters: ChapterDef[];
}

export const CONTROLLED_TAXONOMY: SubjectDef[] = [
  {
    name: 'Physics',
    chapters: [
      { name: 'Units and Measurements', topics: ['Units of measurement', 'Dimensions of physical quantities', 'Errors in measurement'] },
      { name: 'Kinematics', topics: ['Motion in a straight line', 'Motion in a plane', 'Relative velocity', 'Projectile motion'] },
      { name: 'Laws of Motion', topics: ['Newton’s laws of motion', 'Friction', 'Circular motion'] },
      { name: 'Work, Energy and Power', topics: ['Work done by forces', 'Kinetic and potential energy', 'Work-energy theorem', 'Collisions'] },
      { name: 'Rotational Motion', topics: ['Centre of mass', 'Torque and angular momentum', 'Moment of inertia', 'Rolling motion'] },
      { name: 'Gravitation', topics: ['Universal law of gravitation', 'Gravitational potential energy', 'Escape speed and orbital velocity', 'Kepler’s laws'] },
      { name: 'Properties of Solids and Liquids', topics: ['Elastic behaviour', 'Fluid pressure and Pascal’s law', 'Viscosity and Stokes’ law', 'Surface tension'] },
      { name: 'Thermodynamics', topics: ['Thermal equilibrium and temperature', 'First law of thermodynamics', 'Second law of thermodynamics', 'Carnot engine'] },
      { name: 'Kinetic Theory of Gases', topics: ['Equation of state of a perfect gas', 'Kinetic theory assumptions', 'Degrees of freedom and specific heat'] },
      { name: 'Oscillations and Waves', topics: ['Simple harmonic motion', 'Damped and forced oscillations', 'Wave motion', 'Doppler effect'] },
      { name: 'Electrostatics', topics: ['Coulomb’s law', 'Electric field and potential', 'Gauss’s law and applications', 'Capacitors and dielectrics'] },
      { name: 'Current Electricity', topics: ['Ohm’s law and resistance', 'Kirchhoff’s laws', 'Wheatstone bridge', 'Potentiometer and metre bridge'] },
      { name: 'Magnetic Effects of Current and Magnetism', topics: ['Biot-Savart law', 'Ampere’s law', 'Lorentz force and cyclotron', 'Magnetic properties of materials'] },
      { name: 'Electromagnetic Induction and Alternating Currents', topics: ['Faraday’s laws and Lenz’s law', 'Inductance', 'AC circuits and resonance', 'Transformers'] },
      { name: 'Electromagnetic Waves & Optics', topics: ['Electromagnetic spectrum', 'Ray optics and optical instruments', 'Wave optics and interference', 'Diffraction'] },
      { name: 'Dual Nature of Matter and Radiation & Atoms and Nuclei', topics: ['Photoelectric effect', 'De Broglie wavelength', 'Bohr’s model of hydrogen atom', 'Radioactivity and nuclear energy'] },
      { name: 'Experimental Skills', topics: ['Vernier callipers and screw gauge', 'Metre bridge and potentiometer', 'Simple pendulum and Young’s modulus', 'Resonance tube', 'Semiconductor diode characteristics'] }
    ]
  },
  {
    name: 'Chemistry',
    chapters: [
      { name: 'Some Basic Concepts in Chemistry', topics: ['Matter and its nature', 'Mole concept and molar masses', 'Stoichiometry and percentage composition'] },
      { name: 'Atomic Structure', topics: ['Bohr model of hydrogen atom', 'Quantum mechanical model', 'Quantum numbers and orbitals', 'Electronic configuration'] },
      { name: 'Chemical Bonding and Molecular Structure', topics: ['Ionic and covalent bonding', 'VSEPR theory', 'Valence bond theory and hybridization', 'Molecular orbital theory'] },
      { name: 'Chemical Thermodynamics', topics: ['First law of thermodynamics', 'Enthalpy changes of reactions', 'Entropy and Second law', 'Gibbs free energy'] },
      { name: 'Solutions', topics: ['Concentration terms', 'Raoult’s law and vapour pressure', 'Colligative properties', 'Van’t Hoff factor'] },
      { name: 'Equilibrium', topics: ['Chemical equilibrium and Le Chatelier’s principle', 'Ionic equilibrium and pH', 'Buffer solutions', 'Solubility product'] },
      { name: 'Redox Reactions and Electrochemistry', topics: ['Oxidation states', 'Electrochemical cells and EMF', 'Nernst equation', 'Conductance and Kohlrausch’s law', 'Electrolysis'] },
      { name: 'Chemical Kinetics', topics: ['Rate of chemical reaction', 'Order and molecularity', 'Integrated rate equations', 'Arrhenius equation and activation energy'] },
      { name: 'Classification of Elements and Periodicity in Properties', topics: ['Periodic law and periodic table', 'Periodic trends in ionization enthalpy, electron gain enthalpy, and electronegativity'] },
      { name: 'p-Block Elements', topics: ['Group 13 to 18 elements electronic configuration', 'General trends and anomalous properties', 'Allotropes and important compounds'] },
      { name: 'd- and f-Block Elements', topics: ['Transition elements general properties', 'Oxidation states and colour', 'Lanthanoids and actinoids'] },
      { name: 'Coordination Compounds', topics: ['Werner’s theory', 'IUPAC nomenclature', 'Isomerism in coordination compounds', 'Crystal field theory and valence bond theory'] },
      { name: 'Purification and Characterisation of Organic Compounds', topics: ['Purification methods (distillation, crystallization, chromatography)', 'Qualitative analysis', 'Quantitative estimation of elements'] },
      { name: 'Some Basic Principles of Organic Chemistry', topics: ['IUPAC nomenclature', 'Electronic displacements (inductive, electromeric, resonance, hyperconjugation)', 'Reaction intermediates', 'Isomerism'] },
      { name: 'Hydrocarbons', topics: ['Alkanes and conformations', 'Alkenes and electrophilic addition', 'Alkynes and acidity', 'Aromatic hydrocarbons and Friedel-Crafts reactions'] },
      { name: 'Organic Compounds Containing Halogens', topics: ['Alkyl halides and SN1/SN2 mechanisms', 'Aryl halides and electrophilic substitution', 'Polyhalogen compounds'] },
      { name: 'Organic Compounds Containing Oxygen', topics: ['Alcohols, phenols and ethers', 'Aldehydes and ketones (nucleophilic addition, aldol, Cannizzaro)', 'Carboxylic acids and derivatives'] },
      { name: 'Organic Compounds Containing Nitrogen', topics: ['Amines preparation and properties', 'Diazonium salts and reactions', 'Cyanides and isocyanides'] },
      { name: 'Principles Related to Practical Chemistry', topics: ['Detection of extra elements (N, S, halogens)', 'Detection of functional groups', 'Qualitative salt analysis (cations and anions)', 'Preparation of inorganic compounds'] }
    ]
  },
  {
    name: 'Mathematics',
    chapters: [
      { name: 'Sets, Relations and Functions', topics: ['Sets and representations', 'Relations and types of relations', 'Functions (one-one, onto, composition, inverse)'] },
      { name: 'Complex Numbers and Quadratic Equations', topics: ['Complex numbers algebra and modulus', 'Argand diagram', 'Quadratic equations and roots relations'] },
      { name: 'Matrices and Determinants', topics: ['Matrices operations and types', 'Determinants properties', 'Adjoint and inverse of matrix', 'System of linear equations'] },
      { name: 'Permutations and Combinations', topics: ['Fundamental principle of counting', 'Permutations and circular arrangements', 'Combinations and applications'] },
      { name: 'Mathematical Induction & Binomial Theorem', topics: ['Principle of mathematical induction', 'Binomial theorem for positive integral index', 'General and middle terms'] },
      { name: 'Sequences and Series', topics: ['Arithmetic and geometric progressions', 'Arithmetic-geometric progression', 'Sum of special series'] },
      { name: 'Limit, Continuity and Differentiability', topics: ['Limits of algebraic and trigonometric functions', 'Continuity of functions', 'Differentiability and derivatives', 'Mean value theorems', 'Applications of derivatives (tangents, maxima and minima)'] },
      { name: 'Integral Calculus', topics: ['Indefinite integrals', 'Definite integrals and fundamental theorem', 'Properties of definite integrals', 'Area under curves'] },
      { name: 'Differential Equations', topics: ['Order and degree', 'Formation of differential equations', 'Variable separable method', 'Homogeneous and linear differential equations'] },
      { name: 'Coordinate Geometry (Straight Lines and Circles)', topics: ['Cartesian coordinates and straight lines', 'Slope, forms of equations of a line', 'Circles and standard equations', 'Tangents and normals to circles'] },
      { name: 'Conic Sections', topics: ['Parabola standard equation and properties', 'Ellipse standard equation and properties', 'Hyperbola standard equation and properties'] },
      { name: 'Vector Algebra', topics: ['Vectors and scalars, addition', 'Dot product and cross product', 'Scalar triple product and vector triple product'] },
      { name: 'Three Dimensional Geometry', topics: ['Direction cosines and direction ratios', 'Equation of a straight line in space', 'Equation of a plane', 'Angle and distance between lines and planes'] },
      { name: 'Trigonometry', topics: ['Trigonometric functions and identities', 'Trigonometric equations', 'Inverse trigonometric functions and properties', 'Heights and distances'] },
      { name: 'Probability', topics: ['Probability axioms and conditional probability', 'Bayes’ theorem', 'Random variables and probability distributions', 'Binomial distribution'] },
      { name: 'Statistics', topics: ['Measures of dispersion (range, mean deviation)', 'Variance and standard deviation of grouped and ungrouped data'] },
      { name: 'Mathematical Reasoning', topics: ['Statements, logical connectives (and, or, implies)', 'Tautologies, contradictions, converse, contrapositive'], rationalizedIn2024: true, era: 'pre-2024' }
    ]
  }
];

/** Check if subject is valid in controlled taxonomy */
export function isValidSubject(subject: string): boolean {
  return CONTROLLED_TAXONOMY.some(s => s.name.toLowerCase() === subject.toLowerCase().trim());
}

/** Check if chapter is valid in controlled taxonomy for given subject */
export function isValidChapter(subject: string, chapter: string): boolean {
  const s = CONTROLLED_TAXONOMY.find(s => s.name.toLowerCase() === subject.toLowerCase().trim());
  if (!s) return false;
  return s.chapters.some(c => c.name.toLowerCase() === chapter.toLowerCase().trim());
}

/** Check if topic is valid in controlled taxonomy for given chapter */
export function isValidTopic(subject: string, chapter: string, topic: string): boolean {
  const s = CONTROLLED_TAXONOMY.find(s => s.name.toLowerCase() === subject.toLowerCase().trim());
  if (!s) return false;
  const c = s.chapters.find(c => c.name.toLowerCase() === chapter.toLowerCase().trim());
  if (!c) return false;
  return c.topics.some(t => t.toLowerCase() === topic.toLowerCase().trim());
}

/** Canonical lookup */
export function getCanonicalSubject(name: string): string | null {
  const s = CONTROLLED_TAXONOMY.find(s => s.name.toLowerCase() === name.toLowerCase().trim());
  return s ? s.name : null;
}

export function getCanonicalChapter(subject: string, chapterName: string): string | null {
  const s = CONTROLLED_TAXONOMY.find(s => s.name.toLowerCase() === subject.toLowerCase().trim());
  if (!s) return null;
  const c = s.chapters.find(c => c.name.toLowerCase() === chapterName.toLowerCase().trim());
  return c ? c.name : null;
}
