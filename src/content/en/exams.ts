import type { ExamCategoryId, ExamTextMap } from "../exams";
export { examDetailText } from "./exam-details";

export const metadata = {
  title: "Exam Preparation | Oriens Academy",
  description:
    "Focused exam preparation and academic guidance for IB, AP, IGCSE, A-Level, SAT, ACT, ESAT, TMUA, TARA, UCAT, IMAT, MCAT, GRE, GMAT and OMPT.",
};

export const page = {
  eyebrow: "Exam Preparation",
  title: "The right route for international exams.",
  lead:
    "We read your destination, academic background and application timeline together—then clarify which exam to take, when to take it and how to prepare.",
  heroNote: "Destination → Strategy → Progress",
  indexLabel: "Exam index",
  indexHint: "Go directly to an exam or explore by academic stage.",
  featuredEyebrow: "Featured routes",
  featuredTitle: "Every destination demands a different preparation system.",
  featuredBody:
    "From programme qualifications to undergraduate and graduate admissions, we approach each exam through its own assessment logic.",
  groupsEyebrow: "Academic navigation",
  groupsTitle: "Explore exams by destination.",
  supportLabel: "Oriens Support",
  purposeLabel: "Used for",
  subjectsLabel: "Focus areas",
  audienceLabel: "Designed for",
  categoryAlso: "Also relevant to",
  cta: {
    eyebrow: "Set your direction with us",
    title: "Not sure which exam is right for you?",
    body:
      "Let us assess your target university and current level, then define the right exam and preparation plan.",
    primary: "Book a Free Consultation",
    secondary: "Contact Us",
  },
};

export const detailPage = {
  breadcrumbAria: "Breadcrumb",
  home: "Home",
  exams: "Exams",
  overviewEyebrow: "Understand the exam",
  overviewTitle: (code: string) => `What is ${code}?`,
  audienceLabel: "Who is it for?",
  purposeLabel: "What is it used for?",
  coverageEyebrow: "Academic scope",
  coverageTitle: "What does it assess or cover?",
  supportEyebrow: "The Oriens approach",
  supportTitle: "How we support preparation",
  preparationEyebrow: "Study system",
  preparationTitle: "Preparation areas",
  factsLabel: "Academic reference",
  officialNote: "Test structures, content, dates and registration requirements can change. Verify current information for your application cycle with the official test provider and target institution.",
  relatedEyebrow: "Next directions",
  relatedTitle: "Related exams",
  faqEyebrow: "Common questions",
  faqTitle: "What to know before preparing",
  primaryCta: "Book a Consultation",
  secondaryCta: "Back to Exams",
  visualLabel: (code: string) => `Academic navigation visual for ${code}`,
};

export const categories: Record<ExamCategoryId, { label: string; description: string }> = {
  "international-curriculum": {
    label: "International Curriculum & Diploma",
    description: "International secondary curricula, diplomas, and general university qualification programmes.",
  },
  "admission-specific": {
    label: "Admissions & Programme-Specific Tests",
    description: "Specialized selection exams for academic reasoning, engineering, medicine, law, business, and graduate entry.",
  },
};

export const examText: ExamTextMap = {
  IB: {
    title: "International Baccalaureate",
    shortDescription: "Integrated support across IB Diploma Programme subjects, internal assessments and final examinations.",
    purpose: "An international secondary qualification and university applications worldwide",
    audience: "IB DP students",
    subjects: ["Mathematics AA/AI", "Physics", "Chemistry", "IA strategy"],
    ctaLabel: "Explore IB preparation",
  },
  AP: {
    title: "Advanced Placement",
    shortDescription: "Preparation that connects AP course content with exam technique and university-credit goals.",
    purpose: "Advanced secondary-level subject qualification and potential university credit",
    audience: "Secondary students taking AP courses",
    subjects: ["Calculus", "Statistics", "Physics", "Chemistry"],
    ctaLabel: "Explore AP preparation",
  },
  IGCSE: {
    title: "International GCSE",
    shortDescription: "Support that strengthens foundations while building full command of the syllabus and question formats.",
    purpose: "International secondary qualification and progression to advanced academic programmes",
    audience: "IGCSE students",
    subjects: ["Mathematics", "Additional Mathematics", "Sciences"],
    ctaLabel: "Explore IGCSE preparation",
  },
  "A-Level": {
    title: "GCE A-Level",
    shortDescription: "In-depth subject mastery, analytical problem solving and exam technique for UK and global universities.",
    purpose: "Primary academic qualification for UK and international university applications",
    audience: "Students enrolled in Cambridge, Edexcel or OxfordAQA A-Level qualifications",
    subjects: ["Pure Mathematics", "Further Mathematics", "Physics", "Chemistry"],
    ctaLabel: "Explore A-Level preparation",
  },
  SAT: {
    title: "Digital SAT",
    shortDescription: "A diagnostic-led Digital SAT plan covering knowledge gaps, timing and practice-test analysis.",
    purpose: "An academic indicator for undergraduate admission, particularly in the United States",
    audience: "International undergraduate applicants",
    subjects: ["Reading & Writing", "Math", "Digital strategy"],
    ctaLabel: "Explore SAT preparation",
  },
  ACT: {
    title: "ACT",
    shortDescription: "Fast-paced problem solving, scientific reasoning and time-management strategies for top US colleges.",
    purpose: "Standardized admissions test for undergraduate admissions in the US and globally",
    audience: "High school students preparing for US and global admissions",
    subjects: ["Math", "Science Reasoning", "Reading", "English"],
    ctaLabel: "Explore ACT preparation",
  },
  ESAT: {
    title: "Engineering and Science Admissions Test",
    shortDescription: "Advanced problem-solving preparation aligned with the modules required by engineering and science courses.",
    purpose: "Admission to Cambridge, Imperial and selected UK engineering and science programmes",
    audience: "Engineering and science applicants",
    subjects: ["Mathematics 1", "Mathematics 2", "Physics", "Chemistry"],
    ctaLabel: "Explore ESAT preparation",
  },
  TMUA: {
    title: "Test of Mathematics for University Admission",
    shortDescription: "Preparation for advanced mathematical thinking and proof-led reasoning under time pressure.",
    purpose: "Admission to Cambridge, Imperial, LSE, and Warwick mathematics, economics and computer science programmes",
    audience: "Applicants to mathematics-intensive degrees",
    subjects: ["Mathematical Thinking", "Reasoning", "Problem Solving"],
    ctaLabel: "Explore TMUA preparation",
  },
  TARA: {
    title: "Test of Academic Reasoning for Admissions (TARA)",
    shortDescription: "Critical Thinking, Problem Solving and Writing Task preparation for the UAT-UK admissions test.",
    purpose: "Programme-specific academic reasoning assessment for participating universities",
    audience: "Applicants to programmes that use TARA in the relevant admission cycle",
    subjects: ["Critical Thinking", "Problem Solving", "Writing Task"],
    ctaLabel: "Explore TARA preparation",
  },
  UCAT: {
    title: "University Clinical Aptitude Test (UCAT)",
    shortDescription: "Preparation for cognitive skills, decision making and timing in the medical admissions test.",
    purpose: "Admission to UK, Australia and international medicine and dentistry programmes",
    audience: "Medicine and dentistry applicants",
    subjects: ["Verbal Reasoning", "Decision Making", "Quantitative Reasoning", "Situational Judgement"],
    ctaLabel: "Explore UCAT preparation",
  },
  IMAT: {
    title: "International Medical Admissions Test",
    shortDescription: "Scientific-knowledge and reasoning preparation for English-taught medical programmes in Italy.",
    purpose: "Admission to selected English-taught medical programmes in Italy",
    audience: "Applicants planning to study medicine in Italy",
    subjects: ["Biology", "Chemistry", "Physics", "Mathematics", "Logical Reasoning"],
    ctaLabel: "Explore IMAT preparation",
  },
  MCAT: {
    title: "Medical College Admission Test (MCAT)",
    shortDescription: "Comprehensive preparation covering biochemistry, physics, psychology, and critical analysis.",
    purpose: "Standardized admissions exam for medical schools (MD / DO) in the US and Canada",
    audience: "Pre-med students targeting North American medical schools",
    subjects: ["Biological Systems", "Chemical Foundations", "CARS", "Psychological Foundations"],
    ctaLabel: "Explore MCAT preparation",
  },
  GRE: {
    title: "Graduate Record Examination",
    shortDescription: "A graduate-admissions plan spanning quantitative reasoning, verbal analysis and analytical writing.",
    purpose: "Admission to international master's and doctoral programmes",
    audience: "Prospective graduate students",
    subjects: ["Quantitative", "Verbal", "Analytical Writing"],
    ctaLabel: "Explore GRE preparation",
  },
  GMAT: {
    title: "Graduate Management Admission Test (Focus)",
    shortDescription: "Business-school preparation integrating data, quantitative and verbal reasoning.",
    purpose: "Admission to MBA and other graduate business programmes",
    audience: "Business-school applicants",
    subjects: ["Quantitative", "Verbal", "Data Insights"],
    ctaLabel: "Explore GMAT preparation",
  },
  OMPT: {
    title: "Online Mathematics Placement Test",
    shortDescription: "Preparation for the mathematics requirement specified by each university or programme's OMPT variant.",
    purpose: "Meeting programme-specific mathematics entry requirements for Dutch and European universities",
    audience: "Applicants to programmes requiring OMPT",
    subjects: ["Algebra & Functions", "Calculus", "Trigonometry", "Test Variant Specifics"],
    ctaLabel: "Explore OMPT preparation",
  },
};
