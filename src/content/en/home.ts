import { Fingerprint, Globe2, Target, Users, type LucideIcon } from "lucide-react";

/** English — homepage-specific copy. */

export const hero = {
  eyebrow: "International Education Consultancy",
  headline: "Your bearing to the university you're aiming for.",
  body: "Oriens Academy pairs rigorous exam preparation with individual academic guidance — for students navigating IB, AP, SAT and university admissions worldwide.",
  ctaPrimary: "Book a Consultation",
  ctaSecondary: "Explore the Method",
};

export const trustResults = {
  eyebrow: "Support structured around academic goals",
  items: [
    { title: "International exam preparation", description: "Dedicated content for twelve exams within one clear planning approach." },
    { title: "University academic support", description: "Concept review, problem solving and structured study support." },
    { title: "Turkish and English", description: "Academic content and consultation journeys available in both languages." },
    { title: "Transparent pricing", description: "Programme options and starting prices are clearly presented on a dedicated page." },
  ],
};

export const examPreparation = {
  eyebrow: "Exam Preparation",
  headline: "Twelve exams. One rigorous method.",
  body: "Whichever qualification stands between a student and their target university, preparation follows the same disciplined process — diagnosed, mapped, measured.",
  categories: [
    {
      label: "Secondary & University Entrance",
      exams: ["IB", "AP", "IGCSE", "SAT", "TMUA", "ESAT"],
    },
    {
      label: "Specialist Admissions Tests",
      exams: ["UKCAT", "IMAT", "OMPT", "TARA"],
    },
    {
      label: "Graduate & Postgraduate",
      exams: ["GRE", "GMAT"],
    },
  ],
};

export const oriensMethod = {
  eyebrow: "The Oriens Method",
  headline: "Six stages. One continuous bearing.",
  stages: [
    {
      n: "01",
      name: "Understand",
      copy: "A full academic diagnostic: strengths, gaps, and the target you're aiming for.",
    },
    {
      n: "02",
      name: "Map",
      copy: "We chart the specific route — subjects, timelines, exams — from where you are to where you're going.",
    },
    {
      n: "03",
      name: "Prepare",
      copy: "Structured, expert-led tutoring against the map, not a generic curriculum.",
    },
    {
      n: "04",
      name: "Measure",
      copy: "Regular assessment under real exam conditions — progress is tracked, not assumed.",
    },
    {
      n: "05",
      name: "Refine",
      copy: "The plan adjusts as results come in. Precision compounds.",
    },
    {
      n: "06",
      name: "Advance",
      copy: "Applications, interviews, and the final approach to the offer.",
    },
  ],
};

export const signatureMathematics = {
  eyebrow: "Precision, Demonstrated",
  headline: "Move the point. Watch the tangent respond.",
  body: "This is the kind of precision our students bring to exam day — not a memorized answer, but an exact relationship, understood.",
  sliderLabel: "Position along the curve",
  readout: { point: "Point", value: "Value", slope: "Slope" },
};

export const universitySupport = {
  eyebrow: "University Support",
  headline: "The degree doesn't end the guidance. It changes its shape.",
  areas: [
    {
      n: "I",
      title: "Coursework & Problem Sets",
      copy: "Week-to-week support across STEM and quantitative courses, from problem sets to lab reports.",
    },
    {
      n: "II",
      title: "Thesis & Research Guidance",
      copy: "Structuring arguments, methodology and academic writing at dissertation level.",
    },
    {
      n: "III",
      title: "Exam & Midterm Intensives",
      copy: "Focused revision sprints before finals — the material that actually appears on the exam.",
    },
    {
      n: "IV",
      title: "Study Skills for University",
      copy: "Time management, note systems and the independent-learning method the transition from school demands.",
    },
  ],
  visualCaption: "First year to graduation — a single, deliberate direction of travel.",
};

export const whyOriens = {
  eyebrow: "Why Oriens",
  headline: "What a bearing actually requires.",
  reasons: [
    {
      icon: Fingerprint as LucideIcon,
      title: "Bespoke, not templated",
      copy: "Every plan is mapped to the individual student — never a generic curriculum applied at scale.",
    },
    {
      icon: Target as LucideIcon,
      title: "Evidence over assumption",
      copy: "Every recommendation is backed by real diagnostic data, tracked and revisited.",
    },
    {
      icon: Globe2 as LucideIcon,
      title: "International exam focus",
      copy: "Exam-specific preparation content is available for IB, AP, SAT and other international assessments.",
    },
    {
      icon: Users as LucideIcon,
      title: "An individual approach",
      copy: "The focus is shaped around the student's needs, current level and academic goal.",
    },
  ],
};

export const instructorAbout = {
  eyebrow: "Academic Guidance",
  name: "An academic route shaped around the student",
  body: "Oriens brings exam preparation and university-level academic support together in a study process planned around individual needs.",
  credentials: ["Needs analysis", "Subject-focused preparation", "Progress review"],
  photoPlaceholder: "The Oriens academic approach",
  tangentCaption: "A clearer direction at every stage.",
};

export const resultsTestimonials = {
  eyebrow: "Student Experience",
  headline: "Verified experiences.",
  functionPlotCaption: "Academic progress is reviewed throughout the process.",
  testimonials: [] as Array<{ quote: string; name: string; context: string }>,
};

export const pricingPreview = {
  eyebrow: "Pricing",
  headline: "Programs built around the destination, not the calendar.",
  body: "A full proposal follows the initial consultation. This is a starting point.",
  featuredTag: "Most Chosen",
  ctaLabel: "Book a Consultation",
  tiers: [
    {
      id: "foundation",
      name: "Foundation",
      description: "For focused, single-subject preparation.",
      price: "From €90",
      cadence: "/ session",
      features: ["Weekly 1:1 sessions", "Full diagnostic assessment", "Progress reporting"],
    },
    {
      id: "method",
      name: "Method",
      description: "Our full multi-subject exam preparation program.",
      price: "From €320",
      cadence: "/ month",
      featured: true,
      features: [
        "Everything in Foundation",
        "Full Oriens Method mapping",
        "Bi-weekly mock exams",
        "Direct instructor access",
      ],
    },
    {
      id: "immersive",
      name: "Immersive",
      description: "Comprehensive support through university admissions.",
      price: "Custom",
      cadence: "",
      features: [
        "Everything in Method",
        "University application guidance",
        "Interview preparation",
        "Dedicated case manager",
      ],
    },
  ],
};

export const bookingCTA = {
  headline: "Begin with a conversation.",
  body: "In a complimentary initial consultation, we'll discuss where the student stands today and what a realistic route to their target looks like.",
  successTitle: "Request received.",
  successBody: "We'll use the contact details you shared to follow up and arrange the consultation.",
  form: {
    name: "Full name",
    email: "Email",
    interestLabel: "I'm interested in",
    interestOptions: [
      { value: "exam-preparation", label: "Exam Preparation" },
      { value: "university-support", label: "University Support" },
      { value: "both", label: "Both" },
    ],
    messageLabel: "Message",
    messageOptional: "(optional)",
    submit: "Request a Consultation",
    requiredLabel: "required",
    errorSummary: "Please check the following fields:",
    nameRequired: "Full name is required.",
    emailRequired: "Email is required.",
    emailInvalid: "Enter a valid email address.",
  },
};

export const faq = {
  eyebrow: "FAQ",
  headline: "Questions, answered directly.",
  items: [
    {
      id: "faq-1",
      q: "Which exam systems does Oriens Academy cover?",
      a: "IB, AP, IGCSE, SAT, TMUA and ESAT at secondary level; UKCAT, IMAT, OMPT and TARA for specialist admissions; and GRE and GMAT at graduate level.",
    },
    {
      id: "faq-2",
      q: "Are sessions delivered in person or online?",
      a: "Both. Most students work with us remotely, with the same instructor throughout — in-person sessions are available in select cities.",
    },
    {
      id: "faq-3",
      q: "How is a student's program decided?",
      a: "Every program begins with a full diagnostic assessment. The Method — Understand, Map, Prepare, Measure, Refine, Advance — is built from that result, not assumed in advance.",
    },
    {
      id: "faq-4",
      q: "Do you support students already at university?",
      a: "Yes — coursework support, thesis and research guidance, and exam intensives are available throughout an undergraduate or graduate degree, not only before admission.",
    },
    {
      id: "faq-5",
      q: "What happens after the consultation?",
      a: "You'll receive a written proposal within two business days, outlining the recommended program, cadence, and an initial timeline toward the target exam or intake.",
    },
  ],
};

export const examSelector = {
  heading: "Which exam are you preparing for?",
  inputPlaceholder: "Type an exam name — e.g. SAT, IB, TMUA",
  noResults: "No matching exam found.",
  otherLabel: "Other",
  otherInputLabel: "Tell us which exam you're preparing for",
  otherPlaceholder: "Type the exam name",
  selectedSubtitle: "International Exam Preparation",
  selectedSrAnnounce: "selected.",
  changeLabel: "Change",
  listboxLabel: "Exam results",
};

export const bookingFlow = {
  eyebrow: "Online Booking",
  headline: "Schedule your initial consultation.",
  subheadline: "Select an available consultation time and share your academic goals to begin.",
  steps: [
    { title: "Academic Focus", subtitle: "Select support area" },
    { title: "Appointment Time", subtitle: "Choose date & slot" },
    { title: "Contact Info", subtitle: "Your details" },
    { title: "Review & Submit", subtitle: "Final confirmation" },
  ],
  supportTypeOptions: [
    { value: "exam_preparation", label: "Exam Preparation", description: "Targeted support for IB, AP, SAT, or specialist admissions tests." },
    { value: "university_support", label: "University Support", description: "Coursework, quantitative subjects, and thesis guidance." },
    { value: "general_consultation", label: "General Consultation", description: "Academic roadmap diagnostic and general strategic planning." },
  ],
  step1: {
    title: "What is your primary academic goal?",
    notesLabel: "Additional context or specific goals",
    notesPlaceholder: "Share details about current target grades, upcoming exam dates, or specific areas of focus...",
  },
  step2: {
    title: "Select an available appointment time",
    emptyStateTitle: "No available online consultation slots currently.",
    emptyStateBody: "All current online slots have been filled. You can send us a message directly to arrange a consultation.",
    contactCta: "Contact Us Directly",
    timezoneNotice: "All times displayed in your local timezone:",
    slotSelected: "Selected slot:",
  },
  step3: {
    title: "Enter your contact details",
    phoneLabel: "Phone number",
    phoneOptional: "(optional)",
    privacyConsentLabel: "I agree to the processing of my contact information for organizing this consultation.",
    privacyConsentRequired: "You must accept the privacy policy to proceed.",
    marketingConsentLabel: "Keep me updated with academic guidance insights and news (optional).",
  },
  step4: {
    title: "Review & Confirm your request",
    academicSummary: "Academic Focus",
    slotSummary: "Appointment Time",
    contactSummary: "Contact Details",
    notesSummary: "Notes",
    submitButton: "Confirm & Send Booking Request",
    submittingButton: "Processing Reservation...",
  },
  slotUnavailableNotice: "The selected time slot was just reserved by another visitor. Please select another available time.",
  success: {
    title: "Consultation request received.",
    body: "Your consultation request has been submitted successfully with status pending confirmation. We will reach out to you shortly using the contact details provided.",
    referenceLabel: "Booking Reference:",
    homeCta: "Return to Homepage",
  },
  actions: {
    back: "Back",
    continue: "Continue",
  },
};

