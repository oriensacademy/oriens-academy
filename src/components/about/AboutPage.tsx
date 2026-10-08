"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Camera,
  Clock3,
  GraduationCap,
  Mail,
  MessageCircle,
  Phone,
  Target,
  Users,
} from "lucide-react";
import { Reveal } from "@/components/motion/Reveal";
import { useAboutContent, useLocale } from "@/content/locale-context";
import { useSiteContact } from "@/lib/contact-settings";
import { localizedPath } from "@/lib/routes";
import styles from "./about-page.module.css";

const PRINCIPLE_ICONS: LucideIcon[] = [Target, Users, BarChart3, Clock3, Award, GraduationCap];

function LessonIllustration({ label }: { label: string }) {
  return (
    <div className={styles.illustration} role="img" aria-label={label}>
      <div className={styles.board}>
        <span>SAT · IB</span>
        <strong>f(x) = ax² + bx + c</strong>
        <i aria-hidden="true" />
      </div>
      <div className={styles.tutor} aria-hidden="true">
        <span className={styles.head} />
        <span className={styles.body} />
        <span className={styles.arm} />
      </div>
      <span className={styles.live}><i /> LIVE</span>
      <span className={styles.lessonTag}>Calculus</span>
    </div>
  );
}

export function AboutPage() {
  const locale = useLocale();
  const content = useAboutContent();
  const contact = useSiteContact();
  const isTr = locale === "tr";
  const bookingHref = `${localizedPath("home", locale)}#consultation-form`;
  const principles = [
    ...content.principles.items,
    { id: "faculty", title: content.team.eyebrow, description: content.team.intro },
  ];
  const contacts = [
    { icon: MessageCircle, title: "WhatsApp", value: contact.whatsappDisplay, href: contact.whatsappHref, external: true },
    { icon: Phone, title: isTr ? "Telefon" : "Phone", value: contact.landlineDisplay, href: contact.landlineHref },
    { icon: Mail, title: isTr ? "E-posta" : "Email", value: contact.email, href: contact.emailHref },
    { icon: Camera, title: "Instagram", value: "@oriens.academy", href: contact.instagramHref, external: true },
  ];

  return (
    <main className={styles.root}>
      <section className={styles.hero}>
        <div className={styles.container}>
          <nav className={styles.breadcrumb} aria-label={content.breadcrumb.ariaLabel}>
            <Link href={localizedPath("home", locale)}>{content.breadcrumb.home}</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">{content.breadcrumb.current}</span>
          </nav>
          <div className={styles.heroGrid}>
            <Reveal className={styles.heroCopy} y={10}>
              <p className={styles.eyebrow}>{content.hero.eyebrow}</p>
              <h1>{content.hero.title}</h1>
              <p className={styles.lead}>{content.hero.description}</p>
              <div className={styles.actions}>
                <Link href={bookingHref} className={styles.primary}>{content.hero.primaryCta}<ArrowRight size={17} /></Link>
                <Link href={localizedPath("exams", locale)} className={styles.secondary}>{content.hero.secondaryCta}</Link>
              </div>
            </Reveal>
            <Reveal delay={0.1} className={styles.visual}><LessonIllustration label={content.hero.visualLabel} /></Reveal>
          </div>
        </div>
      </section>

      <section className={styles.principles}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>{content.principles.eyebrow}</p>
            <h2>{content.principles.title}</h2>
            <p>{content.principles.intro}</p>
          </div>
          <div className={styles.principleGrid}>
            {principles.map((item, index) => {
              const Icon = PRINCIPLE_ICONS[index] || BookOpen;
              return (
                <article className={styles.principleCard} key={item.id}>
                  <span className={styles.cardIcon}><Icon size={21} /></span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.schools}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>{content.outcomes.eyebrow}</p>
            <h2>{content.outcomes.title}</h2>
            <p>{content.outcomes.intro}</p>
          </div>
          <div className={styles.schoolGrid}>
            {content.outcomes.items.map((school, index) => (
              <article className={styles.schoolCard} key={school.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div><h3>{school.title}</h3><p>{school.description}</p></div>
              </article>
            ))}
          </div>
          <p className={styles.disclaimer}>{content.outcomes.disclaimer}</p>
        </div>
      </section>

      <section className={styles.contact}>
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>{content.trust.eyebrow}</p>
            <h2>{content.trust.title}</h2>
            <p>{content.trust.intro}</p>
          </div>
          <div className={styles.contactGrid}>
            {contacts.map(({ icon: Icon, title, value, href, external }) => (
              <a key={title} href={href} className={styles.contactCard} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                <span className={styles.contactIcon}><Icon size={21} /></span>
                <strong>{title}</strong>
                <small>{value}</small>
                <ArrowRight size={16} />
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
