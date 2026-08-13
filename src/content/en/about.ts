import type { AboutContent } from "../about";

export const about: AboutContent = {
  metadata: {
    title: "About Us | Oriens Academy",
    description: "Meet founder Tutor Doğuhan. A focused, measurable process for IB, AP, SAT, ESAT, TARA, TMUA, IGCSE built around how each exam actually works.",
  },
  breadcrumb: { ariaLabel: "Breadcrumb", home: "Home", current: "About Us" },
  hero: {
    eyebrow: "About Us",
    title: "Meet our founder.",
    description: "A Mathematics-Physics tutor with over 10 years of one-on-one work with IB, AP, SAT, ESAT, TARA, TMUA and IGCSE students — including students from international-curriculum schools such as Robert College, St. Joseph, Liceo Italiano and Üsküdar American Academy. The approach is built on understanding how each exam actually works, not memorisation.",
    primaryCta: "Free Intro Call",
    secondaryCta: "Explore Exams",
    visualLabel: "Tutor Doğuhan — Mathematics & Physics Tutor",
    visualSteps: ["Robert College", "St. Joseph", "Liceo Italiano", "Üsküdar American"],
  },
  story: {
    eyebrow: "Our Approach",
    title: "Built on understanding how each exam actually works, not memorisation.",
    paragraphs: [
      "For over 10 years, we have worked one-on-one with students studying international curricula. We support students from leading international-curriculum schools such as Robert College, St. Joseph, Liceo Italiano, and Üsküdar American Academy in reaching their academic goals.",
      "Every exam has its own language, scoring logic, and time pressure, so preparation is built around that exam specifically.",
    ],
    note: "Doğuhan — Mathematics & Physics Tutor & Founder of Oriens Academy",
  },
  principles: {
    eyebrow: "Principles",
    title: "Core principles guiding our approach.",
    intro: "Every lesson and preparation process is grounded in these five core principles.",
    items: [
      { id: "direction", title: "Exam Logic", description: "Focusing on understanding the logic behind questions, rather than memorisation." },
      { id: "individualisation", title: "1-on-1 Sessions", description: "Lessons tailored specifically to the student's level, pace, and topic gaps." },
      { id: "clarity", title: "Measurable Progress", description: "Regular timed mock exams and clear diagnostic assessments." },
      { id: "review", title: "Time Management", description: "Techniques and strategies for managing real time pressure during exams." },
      { id: "integrity", title: "Academic Trust", description: "10+ years of experience offering reliable guidance on the path to top universities." },
    ],
  },
  team: {
    eyebrow: "Tutor",
    title: "Founding Tutor",
    intro: "Mathematics & Physics tutor with 10+ years of experience.",
    members: [
      {
        id: "doguhan",
        name: "Doğuhan",
        role: "Mathematics & Physics Tutor / Founder",
        bio: "Providing 1-on-1 support for over 10 years across IB, AP, SAT, ESAT, TARA, TMUA, IGCSE and university-level maths & physics courses.",
        credentials: ["Robert College", "St. Joseph", "Liceo Italiano", "Üsküdar American"],
      },
    ],
    fallbackTitle: "Direct 1-on-1 Support",
    fallbackBody: "All lessons are conducted directly under the guidance of our founding tutor, Doğuhan.",
    fallbackPoints: ["10+ Years Experience", "Robert College & Target Schools", "Tailored 1-on-1 Structure"],
  },
  brandMoment: {
    eyebrow: "Oriens Academy",
    title: "Let's chart your course.",
    body: "Creating the ideal study route for your target university and exam.",
    steps: ["Analysis", "Strategy", "Practice", "Results"],
  },
  outcomes: {
    eyebrow: "Our Schools",
    title: "Student communities we work with.",
    intro: "We regularly work with students from Turkey's leading international-curriculum high schools.",
    metrics: [],
    items: [
      { title: "Robert College", description: "Targeted subject support across IB and AP courses." },
      { title: "St. Joseph", description: "French/international curriculum maths and physics support." },
      { title: "Liceo Italiano", description: "Italian High School curriculum and IMAT / entrance exam prep." },
      { title: "Üsküdar American Academy", description: "1-on-1 support for IB HL/SL subjects and SAT preparation." },
    ],
    disclaimer: "All school names represent institutions where our students are currently enrolled.",
  },
  trust: {
    eyebrow: "Contact Channels",
    title: "Get in touch.",
    intro: "Direct contact channels for questions and lesson bookings:",
    examLabel: "Contact",
    links: [
      { route: "contact", title: "WhatsApp", description: "Send an instant message via +90 544 293 90 40.", linkLabel: "Chat on WhatsApp" },
      { route: "contact", title: "Email", description: "Write to oriensacademy@gmail.com for details.", linkLabel: "Send Email" },
      { route: "contact", title: "Instagram", description: "Follow our @oriens.academy profile.", linkLabel: "View Instagram" },
    ],
  },
  testimonials: {
    eyebrow: "What Students Say",
    title: "A few of over 111 student and parent reviews.",
    items: [
      {
        id: "1",
        quote: "My son's IB Physics grade improved noticeably, and he now enjoys the subject.",
        author: "Ahu G.",
        role: "Parent · IB Physics",
      },
      {
        id: "2",
        quote: "My son's motivation and confidence in IB HL Maths and Physics grew noticeably.",
        author: "Yasemin T.",
        role: "Parent · IB HL Maths & Physics",
      },
      {
        id: "3",
        quote: "He teaches hard subjects in simple ways — I passed all my maths and physics exams with high grades.",
        author: "Ahmet S.",
        role: "Student · University Physics",
      },
      {
        id: "4",
        quote: "Delivered noticeable progress in a short time — a highly capable tutor.",
        author: "Ece A.",
        role: "Student · AYT Exam Prep",
      },
      {
        id: "5",
        quote: "Helped me get over my fear of geometry quickly, making the subject enjoyable with practical tips.",
        author: "Ada Elif A.",
        role: "Student · High School Maths & Physics",
      },
      {
        id: "6",
        quote: "Quickly identified our daughter's gaps and prepared her successfully for her written exam.",
        author: "Bülent I.",
        role: "Parent",
      },
    ],
  },
  cta: {
    eyebrow: "Introductory Call",
    title: "Ready to get started?",
    body: "Fill out the form or reach out directly. The first call is free.",
    primary: "Free Intro Call",
    secondary: "Contact Us",
  },
};
