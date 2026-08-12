import type { UniversitySupportContent } from "../university-support";

export const universitySupport = {
  metadata: {
    title: "University Academic Support | Oriens Academy",
    description:
      "Individual academic support for university students, connecting concept review, problem solving and assessment preparation with the content of their course.",
  },
  breadcrumb: { ariaLabel: "Breadcrumb", home: "Home", current: "University Support" },
  hero: {
    eyebrow: "University Academic Support",
    title: "Beyond passing the course: understand what you are learning.",
    description:
      "Oriens guides university students through the content and rhythm of their own course—clarifying concepts, structuring problem solving and turning study into a process that can be reviewed.",
    primaryCta: "Book a Consultation",
    secondaryCta: "Explore Support Areas",
    visualLabel: "An academic coordinate study showing a function, its tangent and structured notes",
    visualNote: "Concept · application · feedback",
  },
  audience: {
    eyebrow: "Who is it for?",
    title: "You do not have to lose your bearings inside a course.",
    intro:
      "Support is shaped around the student's actual course, current understanding and immediate academic responsibilities—not a generic programme.",
    items: [
      { title: "Students seeking clarity", description: "University students who want to connect the core ideas in lectures, notes and assigned sources." },
      { title: "Students preparing for assessment", description: "Those who want to identify gaps and revise methodically before a quiz, midterm or final." },
      { title: "Students developing problem solving", description: "Those who want to analyse a problem and select a method rather than memorise a finished solution." },
    ],
  },
  areas: {
    eyebrow: "Academic support areas",
    title: "Defined by the real academic need, not only the course name.",
    intro:
      "These areas reflect support already described in Oriens project content. The scope of a specific course is confirmed after reviewing the student's syllabus and materials.",
    indexLabel: "Support index",
    categoryLabels: {
      quantitative: "STEM & quantitative",
      assessment: "Assessment preparation",
      "academic-work": "Academic work",
      "study-systems": "Study systems",
    },
    items: [
      {
        id: "coursework-problem-sets",
        slug: "coursework-problem-sets",
        title: "Coursework & Problem Sets",
        shortDescription: "Individual support that structures concepts through weekly study, course materials and problem sets across STEM and quantitative courses.",
        category: "quantitative",
        topics: ["Concept review", "Problem solving", "Weekly study"],
        featured: true,
        order: 1,
      },
      {
        id: "assessment-review",
        slug: "quiz-midterm-final-preparation",
        title: "Quiz, Midterm & Final Preparation",
        shortDescription: "Turning the assessed course scope, identified gaps and question practice into a manageable revision plan.",
        category: "assessment",
        topics: ["Topic mapping", "Focused revision", "Question practice"],
        featured: false,
        order: 2,
      },
      {
        id: "academic-work",
        slug: "academic-work-guidance",
        title: "Academic Work Guidance",
        shortDescription: "A focus on structure, methodology and academic writing for lab reports, research and dissertation work already within the project's stated scope.",
        category: "academic-work",
        topics: ["Argument structure", "Methodology", "Academic writing"],
        featured: false,
        order: 3,
      },
      {
        id: "study-skills",
        slug: "university-study-skills",
        title: "University Study Skills",
        shortDescription: "Adapting time management, note systems and independent study habits to a university workload.",
        category: "study-systems",
        topics: ["Time management", "Note systems", "Independent study"],
        featured: false,
        order: 4,
      },
    ],
    scopeNote:
      "Scope is not a blanket claim of expertise across every degree. It is established through an initial review of the student's actual course content.",
  },
  method: {
    eyebrow: "How Oriens works",
    title: "Establish the present position, then map the right study route.",
    intro: "The process is grounded in needs analysis, visible priorities and regular review—not a proprietary formula.",
    steps: [
      { id: "analyse", title: "Analyse the need", description: "We review the syllabus, course materials, upcoming assessments and the points where the student is struggling." },
      { id: "map", title: "Map the concepts", description: "Prerequisites, current topics and gaps are arranged into a clear order." },
      { id: "practise", title: "Apply the concept", description: "Concise concept review is connected to controlled problem and question practice." },
      { id: "review", title: "Review progress", description: "Errors and new needs are examined, and the route is reprioritised when necessary." },
    ],
  },
  visual: {
    eyebrow: "Academic depth",
    title: "Difficulty at one point does not make the entire subject inaccessible.",
    description:
      "As a tangent approaches a function locally, individual support concentrates on the exact point of difficulty. It then reconnects that point to the larger conceptual structure.",
    caption: "Shown: f(x) = 0.35x² − 1 and the tangent at x₀ = 1.2, where f′(x₀) = 0.84.",
    labels: { function: "function", tangent: "tangent", point: "focus point" },
    ariaLabel: "Graph of f of x equals zero point three five x squared minus one and its tangent at x equals one point two",
  },
  approach: {
    eyebrow: "Study approach",
    title: "Explanation, application and feedback in one system.",
    items: [
      { title: "Clarify the concept", description: "Definitions, relationships and prerequisites are rebuilt in a concise but coherent frame." },
      { title: "Structure the problem", description: "Knowns, objectives, constraints and an appropriate method are separated before solving." },
      { title: "Learn from the error", description: "An incorrect result is not simply corrected; we locate where the decision broke down and how to check it." },
    ],
  },
  journey: {
    eyebrow: "Student journey",
    title: "A calm process that moves with the course calendar.",
    intro: "Intensity and focus can change with the student's current academic schedule.",
    steps: [
      { id: "conversation", title: "Initial conversation", description: "We understand the course, objective and immediate calendar." },
      { id: "materials", title: "Material review", description: "The syllabus, notes and assignments confirm the scope." },
      { id: "plan", title: "Individual plan", description: "Priorities and the study sequence are defined." },
      { id: "sessions", title: "Structured study", description: "Concepts and problem solving move forward together." },
      { id: "progress", title: "Progress review", description: "The plan adjusts to new needs." },
    ],
  },
  individual: {
    eyebrow: "Why individual support?",
    title: "Two students in the same course may struggle at different points.",
    body: "Individual study centres the student's course context, prior knowledge and patterns of error. The aim is not to hand over a finished solution, but to build an academic reasoning process the student can use independently.",
    points: ["Course-specific priorities", "Explanation at the student's pace", "Traceable problem solving", "A plan that adapts to the calendar"],
  },
  faq: {
    eyebrow: "Frequently asked questions",
    title: "About university support.",
    items: [
      { question: "Which university courses can Oriens support?", answer: "Existing project content establishes a general support scope across STEM and quantitative courses, problem sets, lab reports, research work and university study skills. Suitability for a specific course is confirmed after reviewing its syllabus and materials." },
      { question: "Is support only available during exam periods?", answer: "No. Study can follow weekly coursework and problem sets, or become more focused before a quiz, midterm or final." },
      { question: "Do I need to share my course materials?", answer: "A syllabus, lecture notes, assignment instructions and the scope of upcoming assessments help us structure support accurately. We establish what is needed at the beginning." },
      { question: "Will Oriens complete my assignment or report for me?", answer: "No. Support focuses on understanding concepts, building structure, selecting methods, receiving feedback and improving the student's own work." },
      { question: "How is study frequency decided?", answer: "We consider course workload, existing gaps and the academic calendar. A suitable rhythm is planned after the initial conversation and material review." },
    ],
  },
  cta: {
    eyebrow: "Clarify your academic direction",
    title: "Let's make the course you are struggling with clearer.",
    body: "We can discuss your course content, current position and immediate calendar to establish an appropriate scope of support.",
    primary: "Book a Consultation",
    secondary: "Get in Touch",
  },
} satisfies UniversitySupportContent;
