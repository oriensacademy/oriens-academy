import React from "react";
import {
  ImageItem,
  PhoneCarousel,
} from "@/components/ui/phone-mockups-1-utils/phone-carousel";

const exampleImages: ImageItem[] = [
  {
    alt: "Oriens exam preparation placeholder",
    eyebrow: "ORIENS ACADEMY",
    title: "Exam Preparation",
    detail: "IB · AP · SAT · TMUA",
    tone: "sage",
  },
  {
    alt: "Oriens personal study plan placeholder",
    eyebrow: "PERSONAL ROUTE",
    title: "Your Study Plan",
    detail: "Clear priorities and regular feedback",
    tone: "ivory",
  },
  {
    alt: "Oriens university support placeholder",
    eyebrow: "ACADEMIC SUPPORT",
    title: "University Pathways",
    detail: "Programme-aware guidance",
    tone: "forest",
  },
  {
    alt: "Oriens progress feedback placeholder",
    eyebrow: "PROGRESS",
    title: "Review & Improve",
    detail: "Lessons, practice and next steps",
    tone: "gold",
  },
];

export default function PhoneMockupBasic() {
  return <PhoneCarousel images={exampleImages} />;
}
