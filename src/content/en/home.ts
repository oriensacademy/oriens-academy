import { Fingerprint, Globe2, Target, Users, type LucideIcon } from "lucide-react";

/** English — homepage-specific copy. */

export const hero = {
  eyebrow: "International Exam Preparation & Academic Consultancy",
  headline: "Let's chart your course to the world's leading universities.",
  body: "We prepare students for IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT and OMPT through a focused, measurable process built around how each exam actually works.",
  ctaPrimary: "Free Intro Call",
  ctaSecondary: "Explore Exams",
};

export const trustResults = {
  eyebrow: "Support structured around academic goals",
  items: [
    { title: "International exam preparation", description: "Targeted preparation and 1-on-1 practice for international exams." },
    { title: "University course support", description: "Support in Calculus, Linear Algebra, Differential Equations, Statistics, and Physics I-II." },
    { title: "Bilingual delivery", description: "Academic content and consultation available in both Turkish and English." },
    { title: "Transparent pricing", description: "Fixed package fees guaranteed until June 2027 and a free intro call." },
  ],
};

export const examPreparation = {
  eyebrow: "Exam Preparation",
  headline: "Goal-focused international exam preparation.",
  body: "Every exam has its own language, scoring logic, and time pressure, so preparation is built around that exam specifically.",
  categories: [
    {
      label: "International Qualifications",
      exams: ["IB", "AP", "SAT", "ESAT", "TARA", "TMUA"],
    },
    {
      label: "Admissions & Placement Tests",
      exams: ["IGCSE", "GRE", "GMAT", "UKCAT", "IMAT", "OMPT"],
    },
  ],
};

export const oriensMethod = {
  eyebrow: "Our Approach",
  headline: "Understanding the exam logic, not memorisation.",
  stages: [
    {
      n: "01",
      name: "Understand",
      copy: "We clarify the student's goals, current level, and topic gaps.",
    },
    {
      n: "02",
      name: "Plan",
      copy: "We build a 1-on-1 study route aligned with the exam's language and format.",
    },
    {
      n: "03",
      name: "Prepare",
      copy: "We apply subject-level depth and exam-specific techniques.",
    },
    {
      n: "04",
      name: "Measure",
      copy: "We build pacing and time management through regular timed mock exams.",
    },
    {
      n: "05",
      name: "Refine",
      copy: "We rapidly close identified gaps based on mock exam results.",
    },
    {
      n: "06",
      name: "Achieve",
      copy: "High performance on exam day and target score improvement.",
    },
  ],
};

export const signatureMathematics = {
  eyebrow: "Mathematics & Physics Focus",
  headline: "Precise problem solving that grasps exam logic.",
  body: "We break down complex quantitative and logical problems into simple, clear solutions.",
  sliderLabel: "Position along the curve",
  readout: { point: "Point", value: "Value", slope: "Slope" },
};

export const universitySupport = {
  eyebrow: "University Support",
  headline: "We go beyond exam preparation.",
  areas: [
    {
      n: "I",
      title: "Calculus & Linear Algebra",
      copy: "Term-long 1-on-1 support for core university mathematics courses.",
    },
    {
      n: "II",
      title: "Physics I & Physics II",
      copy: "Homework help and final-exam preparation for engineering and science physics.",
    },
    {
      n: "III",
      title: "Differential Equations & Statistics",
      copy: "A study routine built around understanding core concepts for midterms and finals.",
    },
    {
      n: "IV",
      title: "Coursework & Final Exam Prep",
      copy: "Regular practice that improves in-term performance and exam grades.",
    },
  ],
  visualCaption: "Support in Calculus, Linear Algebra, Statistics, Physics I-II.",
};

export const whyOriens = {
  eyebrow: "Why Oriens",
  headline: "What sets us apart.",
  reasons: [
    {
      icon: Fingerprint as LucideIcon,
      title: "10+ Years Experience",
      copy: "Over 10 years of 1-on-1 experience with Robert College, St. Joseph, Liceo Italiano, and Üsküdar American students.",
    },
    {
      icon: Target as LucideIcon,
      title: "Exam Logic over Memorisation",
      copy: "An approach built around how each exam actually works and its scoring logic.",
    },
    {
      icon: Globe2 as LucideIcon,
      title: "International Exams",
      copy: "Specialist expertise in IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT, and OMPT.",
    },
    {
      icon: Users as LucideIcon,
      title: "1-on-1 Academic Support",
      copy: "Custom-tailored study flow built around the student's goals and timeline.",
    },
  ],
};

export const instructorAbout = {
  eyebrow: "Our Tutor",
  name: "Doğuhan — Mathematics & Physics Tutor",
  body: "Over 10 years of 1-on-1 work with IB, AP, SAT, ESAT, TARA, TMUA and IGCSE students — an approach built on understanding exam logic, not memorisation.",
  credentials: ["Robert College", "St. Joseph", "Liceo Italiano", "Üsküdar American"],
  photoPlaceholder: "Tutor Doğuhan",
  tangentCaption: "International exam preparation & university course support.",
};

export const resultsTestimonials = {
  eyebrow: "Student Experience",
  headline: "A few of hundreds of student and parent reviews.",
  functionPlotCaption: "Real student and parent reviews.",
  testimonials: [
    {
      quote: "My son's IB Physics grade improved noticeably, and he now enjoys the subject.",
      name: "Ahu G.",
      context: "Parent · IB Physics",
    },
    {
      quote: "My son's motivation and confidence in IB HL Maths and Physics grew noticeably.",
      name: "Yasemin T.",
      context: "Parent · IB HL Mathematics & Physics",
    },
    {
      quote: "He teaches hard subjects in simple ways — I passed all my maths and physics exams with high grades.",
      name: "Ahmet S.",
      context: "Student · University Physics",
    },
    {
      quote: "Delivered noticeable progress in a short time — a highly capable tutor.",
      name: "Ece A.",
      context: "Student · AYT Exam Prep",
    },
    {
      quote: "Helped me get over my fear of geometry quickly, making the subject enjoyable with practical tips.",
      name: "Ada Elif A.",
      context: "Student · Secondary Mathematics & Physics",
    },
    {
      quote: "Quickly identified our daughter's gaps and prepared her successfully for her written exam.",
      name: "Bülent I.",
      context: "Parent",
    },
  ],
};

export const pricingPreview = {
  eyebrow: "Fees",
  headline: "Lesson Package Fees",
  body: "More lessons, better value. The intro call is always free.",
  featuredTag: "Most Popular",
  ctaLabel: "Free Intro Call",
  tiers: [
    {
      id: "package5",
      name: "5-Lesson Package",
      description: "Regular academic support",
      price: "₺15,000",
      cadence: "/ package (7% discount)",
      features: ["5 60-minute 1:1 lessons", "7% package discount", "Regular topic review"],
    },
    {
      id: "package10",
      name: "10-Lesson Package",
      description: "Regular academic support",
      price: "₺27,000",
      cadence: "/ package (15% discount)",
      featured: true,
      features: [
        "10 60-minute 1:1 lessons",
        "15% package discount",
        "Exam and homework tracking",
        "Most popular package",
      ],
    },
    {
      id: "package30",
      name: "30-Lesson Package",
      description: "Maximum long-term value",
      price: "₺72,000",
      cadence: "/ package (25% discount)",
      features: [
        "30 60-minute 1:1 lessons",
        "25% package discount",
        "Season-long academic support",
        "Best per-lesson price (₺2,400)",
      ],
    },
  ],
};

export const bookingCTA = {
  headline: "Free Intro Call",
  body: "Fill in the form and we'll get back to you within 24 hours. The first call is free.",
  successTitle: "Request received.",
  successBody: "We will reach out to you using the contact details provided to schedule your call.",
  form: {
    name: "Full Name",
    email: "Email",
    interestLabel: "I am interested in",
    interestOptions: [
      { value: "exam-preparation", label: "Exam Preparation" },
      { value: "university-support", label: "University Support" },
      { value: "both", label: "Both" },
    ],
    messageLabel: "Message",
    messageOptional: "(optional)",
    submit: "Request Free Intro Call",
    requiredLabel: "required",
    errorSummary: "Please check the following fields:",
    nameRequired: "Full name is required.",
    emailRequired: "Email is required.",
    emailInvalid: "Enter a valid email address.",
  },
};

export const faq = {
  eyebrow: "FAQ",
  headline: "Frequently Asked Questions",
  items: [
    {
      id: "faq-1",
      q: "Which exam systems does Oriens Academy cover?",
      a: "We cover IB, AP, SAT, ESAT, TARA, TMUA, IGCSE, GRE, GMAT, UKCAT, IMAT, and OMPT exams.",
    },
    {
      id: "faq-2",
      q: "How long is each lesson?",
      a: "All of our lessons run for 60 minutes, delivered 1-on-1.",
    },
    {
      id: "faq-3",
      q: "How long are these fees valid for?",
      a: "Our lesson fees are fixed until June 2027.",
    },
    {
      id: "faq-4",
      q: "Which courses are included in university support?",
      a: "We provide support in Calculus, Linear Algebra, Differential Equations, Statistics, Physics I, and Physics II.",
    },
    {
      id: "faq-5",
      q: "Is the introductory call free?",
      a: "Yes. The initial intro call is always completely free.",
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
    { value: "university_support", label: "University Support", description: "Support in Calculus, Linear Algebra, Physics, and STEM courses." },
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
