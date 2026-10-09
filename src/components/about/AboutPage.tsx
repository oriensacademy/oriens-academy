"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowRight, BookOpenCheck, BrainCircuit, Building2, Camera, Clock3, Compass, GraduationCap, Mail, MessageCircle, Phone, Target } from "lucide-react";
import { useAboutContent, useLocale } from "@/content/locale-context";
import { useSiteContact } from "@/lib/contact-settings";
import styles from "./about-page.module.css";

const PRINCIPLE_ICONS: LucideIcon[] = [Target, BrainCircuit, BookOpenCheck, Clock3, Compass, GraduationCap];

function LessonIllustration({ label }: { label: string }) {
  return (
    <div className={styles.illustration}>
      <svg viewBox="0 0 560 400" width="100%" role="img" aria-label={label}>
        <defs><clipPath id="about-screen"><rect x="150" y="60" width="280" height="264" /></clipPath></defs>
        <g className={styles.bob}><path d="M42 44h118a6 6 0 0 1 6 6v32a6 6 0 0 1-6 6H70l-14 12V88H42a6 6 0 0 1-6-6V50a6 6 0 0 1 6-6z" fill="#E7ECE4" /><rect x="52" y="58" width="80" height="6" rx="3" fill="#D3DBD0" /><rect x="52" y="70" width="54" height="6" rx="3" fill="#D3DBD0" /></g>
        <line x1="226" y1="106" x2="336" y2="106" stroke="#DCE3D8" strokeWidth="2" />
        {[22,34,28,46,38,52,30,42].map((height,index)=><rect key={index} className={styles.bar} x={232+index*13} y={105-height} width="8" height={height} rx="2" fill="#DCE3D8" style={{animationDelay:`${index*.18}s`}} />)}
        <g className={styles.spin}><circle cx="470" cy="86" r="42" fill="#E7ECE4" /><path d="M470 86V44a42 42 0 0 1 36 21z" fill="#D3DBD0" /></g>
        <circle cx="78" cy="196" r="20" fill="none" stroke="#E7ECE4" strokeWidth="12" /><path d="M78 176a20 20 0 0 1 20 20" fill="none" stroke="#D3DBD0" strokeWidth="12" />
        <g className={styles.bob} style={{animationDelay:"1.2s"}}><path d="M432 196h96a6 6 0 0 1 6 6v26a6 6 0 0 1-6 6h-82l-14 10v-10a6 6 0 0 1-6-6v-26a6 6 0 0 1 6-6z" fill="#E7ECE4" /><rect x="446" y="208" width="66" height="5" rx="2.5" fill="#D3DBD0" /><rect x="446" y="219" width="44" height="5" rx="2.5" fill="#D3DBD0" /></g>
        <rect x="48" y="300" width="110" height="40" rx="3" fill="#E7ECE4" /><text x="64" y="327" fontFamily="Inter, sans-serif" fontSize="17" fontWeight="700" fill="#CCD5C9">SAT · IB</text>
        <rect x="58" y="270" width="96" height="30" rx="3" fill="#EEF2EC" /><text x="70" y="290" fontFamily="Inter, sans-serif" fontSize="12" fontWeight="600" fill="#CCD5C9">Calculus</text>
        <rect x="138" y="148" width="304" height="194" rx="12" fill="#2E4236" /><rect x="150" y="160" width="280" height="164" rx="3" fill="#FFF" /><rect x="150" y="160" width="280" height="14" fill="#EEF2EC" />
        <circle cx="160" cy="167" r="2.2" fill="#2E4236" /><circle cx="168" cy="167" r="2.2" fill="#2E4236" /><circle cx="176" cy="167" r="2.2" fill="#2E4236" />
        <polygon points="182,188 198,197 198,215 182,224 166,215 166,197" fill="#EEF2EC" stroke="#DCE3D8" /><circle cx="182" cy="202" r="6" fill="#EBC6A2" /><path d="M175 199c2-6 12-7 14-1-4-2-9-2-14 1z" fill="#2B2B2B" /><path d="M172 220c2-8 18-8 20 0z" fill="#819586" /><rect x="206" y="205" width="30" height="3" rx="1.5" fill="#DCE3D8" />
        <g clipPath="url(#about-screen)"><path d="M226 326c2-46 18-74 64-80 46 6 62 34 64 80z" fill="#819586" /><path d="M276 247l14 18 14-18" fill="none" stroke="#4E6A57" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /><line x1="290" y1="268" x2="290" y2="326" stroke="#6F8574" strokeWidth="2" /><circle cx="290" cy="284" r="2.2" fill="#4E6A57" /><circle cx="290" cy="302" r="2.2" fill="#4E6A57" />
          <g className={styles.waveLeft}><path d="M242 326c-2-20 2-40 10-52" stroke="#819586" strokeWidth="20" strokeLinecap="round" fill="none" /><ellipse cx="254" cy="266" rx="12" ry="16" fill="#EBC6A2" /><path d="M246 254v-10M252 252v-12M258 252v-11M264 256v-8" stroke="#EBC6A2" strokeWidth="5" strokeLinecap="round" /></g>
          <g className={styles.waveRight}><path d="M338 326c2-20-2-40-10-52" stroke="#819586" strokeWidth="20" strokeLinecap="round" fill="none" /><ellipse cx="326" cy="266" rx="12" ry="16" fill="#EBC6A2" /><path d="M334 254v-10M328 252v-12M322 252v-11M316 256v-8" stroke="#EBC6A2" strokeWidth="5" strokeLinecap="round" /></g>
        </g>
        <rect x="281" y="222" width="18" height="28" rx="6" fill="#DDB28E" />
        <g className={styles.head}><ellipse cx="258" cy="200" rx="6" ry="9" fill="#E2B894" /><ellipse cx="322" cy="200" rx="6" ry="9" fill="#E2B894" /><ellipse cx="290" cy="196" rx="32" ry="36" fill="#EBC6A2" /><path d="M256 190c-6-24 6-46 30-48-6-8 6-14 14-6 2-10 18-8 16 4 14 0 18 18 12 30-4-8-12-14-22-14 2 6-2 10-8 8-8-4-16-6-24 0-6 4-12 14-18 26z" fill="#2B2B2B" /><path d="M272 186q6-4 12 0M296 186q6-4 12 0" stroke="#2B2B2B" strokeWidth="2.5" fill="none" strokeLinecap="round" /><ellipse className={styles.blink} cx="278" cy="196" rx="3" ry="3.6" fill="#2B2B2B" /><ellipse className={styles.blink} cx="302" cy="196" rx="3" ry="3.6" fill="#2B2B2B" /><path d="M290 200q-3 8 2 9" stroke="#D4A27F" strokeWidth="2" fill="none" strokeLinecap="round" /><ellipse className={styles.talk} cx="290" cy="216" rx="6" ry="5" fill="#8A3B2E" /></g>
        <g className={styles.bob} style={{animationDelay:".6s"}}><path d="M392 108a30 30 0 1 1-16 54l-14 6 6-14a30 30 0 0 1 24-46z" fill="#FFF" stroke="#C9D3C6" strokeWidth="2" /><circle className={styles.dot} cx="380" cy="139" r="4" fill="#10271B" /><circle className={`${styles.dot} ${styles.dot2}`} cx="393" cy="139" r="4" fill="#10271B" /><circle className={`${styles.dot} ${styles.dot3}`} cx="406" cy="139" r="4" fill="#10271B" /></g>
        <rect x="150" y="306" width="280" height="18" fill="#2E4236" /><text x="156" y="319" fontFamily="Inter, sans-serif" fontSize="7" fill="#B9C7BD">LIVE</text><rect x="176" y="314" width="226" height="3" rx="1.5" fill="#4E6A57" /><rect className={styles.progress} x="176" y="314" width="226" height="3" rx="1.5" fill="#E9B949" /><g className={styles.knob}><circle cx="176" cy="315.5" r="4" fill="#E9B949" /></g><rect x="408" y="311" width="9" height="8" rx="1" fill="none" stroke="#B9C7BD" strokeWidth="1.4" /><path d="M118 342h344l-14 14H132z" fill="#3E5246" /><rect x="262" y="342" width="56" height="5" rx="2.5" fill="#2E4236" /><line x1="90" y1="358" x2="490" y2="358" stroke="#E1E6DD" strokeWidth="2" />
      </svg>
    </div>
  );
}

export function AboutPage() {
  const locale = useLocale();
  const content = useAboutContent();
  const contact = useSiteContact();
  const isTr = locale === "tr";
  const principles = [...content.principles.items, { id: "faculty", title: content.team.eyebrow, description: content.team.intro }];
  const contacts = [
    { icon: MessageCircle, title: "WhatsApp", value: contact.whatsappDisplay, description: isTr ? "Anında mesaj gönderin, hızlı dönüş alın." : "Send an instant message and receive a quick reply.", cta: isTr ? "WhatsApp'tan Yazın" : "Message on WhatsApp", href: contact.whatsappHref },
    { icon: Phone, title: isTr ? "Telefon" : "Phone", value: contact.landlineDisplay, description: isTr ? "Destek hattımızdan doğrudan bize ulaşın." : "Reach us directly through our support line.", cta: isTr ? "Hemen Arayın" : "Call Now", href: contact.landlineHref },
    { icon: Mail, title: isTr ? "E-posta" : "Email", value: contact.email, description: isTr ? "Detaylı bilgi ve randevu talepleri için." : "For detailed information and appointment requests.", cta: isTr ? "E-posta Gönderin" : "Send Email", href: contact.emailHref },
    { icon: Camera, title: "Instagram", value: "@oriens.academy", description: isTr ? "Güncel içerik ve duyurular için takip edin." : "Follow us for current content and announcements.", cta: isTr ? "Instagram'da Görün" : "View on Instagram", href: contact.instagramHref },
  ];

  return <div className={styles.root}>
    <section className={styles.hero}><div className={styles.container}><div className={styles.heroGrid}>
      <div className={styles.heroCopy}><h1>{isTr ? <>Oriens Academy ile <span>tanışın.</span></> : <>Meet <span>Oriens Academy.</span></>}</h1><p>{content.hero.description}</p></div>
      <LessonIllustration label={content.hero.visualLabel} />
    </div></div></section>
    <section className={styles.principles}><div className={styles.container}>
      <p className={styles.eyebrow}>{isTr ? "Yaklaşımımız" : "Our Approach"}</p><div className={styles.sectionHead}><h2>{content.principles.title}</h2><p>{isTr ? "Her ders ve hazırlık süreci bu altı temel ilkeye dayanır." : "Every lesson and preparation process is grounded in these six core principles."}</p></div>
      <ul className={styles.principleGrid}>{principles.map((item,index)=>{const Icon=PRINCIPLE_ICONS[index];return <li className={styles.principleCard} key={item.id}><span className={styles.principleIcon}><Icon size={26} strokeWidth={1.6}/></span><h3>{item.title}</h3><p>{item.description}</p><span className={styles.accent}/></li>})}</ul>
    </div></section>
    <section className={styles.schools}><div className={styles.container}>
      <p className={styles.eyebrow}>{isTr ? "Okullar" : "Schools"}</p><div className={styles.sectionHead}><h2>{content.outcomes.title}</h2><p>{isTr ? "10 yılı aşkın eğitmenlik geçmişimizde bu okullarda öğrenim gören öğrencilerle birebir çalışmalar yer almaktadır." : content.outcomes.intro}</p></div>
      <div className={styles.schoolGrid}>{content.outcomes.items.map((school)=><article className={styles.schoolCard} key={school.title}><span><Building2 size={18} strokeWidth={1.7}/></span><h3>{school.title}</h3><p>{school.description}</p></article>)}</div><p className={styles.disclaimer}>{content.outcomes.disclaimer}</p>
    </div></section>
    <section className={styles.contact}><div className={styles.container}>
      <p className={styles.eyebrow}>{content.trust.eyebrow}</p><h2>{content.trust.title}</h2><p className={styles.contactIntro}>{content.trust.intro}</p>
      <ul className={styles.contactGrid}>{contacts.map(({icon:Icon,...item})=><li className={styles.contactCard} key={item.title}><span className={styles.contactIcon}><Icon size={24} strokeWidth={1.7}/></span><p className={styles.contactTitle}>{item.title}</p><p className={styles.contactValue}>{item.value}</p><p className={styles.contactDescription}>{item.description}</p><a href={item.href} target={item.href.startsWith("http")?"_blank":undefined} rel={item.href.startsWith("http")?"noopener noreferrer":undefined}>{item.cta}<ArrowRight size={15}/></a></li>)}</ul>
    </div></section>
  </div>;
}
