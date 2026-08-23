import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { sendTransactionalEmail } from "../_shared/email/service.ts";

interface QuestionSnapshot {
  id: string;
  prompt: string;
  topicId: string;
  topicLabel: string;
  selectedAnswer: string | null;
  correctAnswer: string;
  wasCorrect: boolean;
  explanation: string;
}

interface TestResultPayload {
  examCode: string;
  total: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number;
  performanceTier: "strong" | "moderate" | "foundation";
  topics: Array<{
    id: string;
    label: string;
    correct: number;
    total: number;
    accuracy: number;
  }>;
  strengths: string[];
  improvementAreas: string[];
  breakdown: Array<{
    id: string;
    question: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
    topicId: string;
  }>;
}

Deno.serve(async (req: Request) => {
  const invalid = validateMutationRequest(req, ["POST"]);
  if (invalid) return invalid;

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = req.headers.get("authorization") || "";

  if (!url || !anon || !service) {
    return buildJsonResponse({ error_code: "SERVER_CONFIG_ERROR" }, 500, req);
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const fullName = String(body.fullName || "").trim();
  const examCode = String(body.examCode || "SAT").toUpperCase();
  const locale = body.locale === "en" ? "en" : "tr";
  const isEn = locale === "en";
  const result = body.result as TestResultPayload;
  const questionSnapshots = (body.questionSnapshots || []) as QuestionSnapshot[];

  if (!email || !email.includes("@") || !email.includes(".")) {
    return buildJsonResponse({ error_code: "INVALID_EMAIL" }, 400, req);
  }

  if (!result || typeof result.accuracy !== "number") {
    return buildJsonResponse({ error_code: "INVALID_RESULT" }, 400, req);
  }

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Check if authenticated user
  let authenticatedUserId: string | null = null;
  if (authorization) {
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData } = await caller.auth.getUser();
    if (userData.user) {
      authenticatedUserId = userData.user.id;
    }
  }

  // If anonymous visitor, generate claim token and save to anonymous_exam_result_claims
  let claimToken: string | null = null;
  if (!authenticatedUserId) {
    claimToken = crypto.randomUUID();
    await admin.from("anonymous_exam_result_claims").insert({
      claim_token: claimToken,
      normalized_email: email,
      exam_code: examCode,
      locale,
      attempt_data: {
        total_questions: result.total,
        correct_count: result.correct,
        incorrect_count: result.incorrect,
        unanswered_count: result.unanswered,
        accuracy: result.accuracy,
        performance_tier: result.performanceTier,
        answers: (result.breakdown || []).reduce((acc, b) => {
          acc[b.id] = b.selectedAnswer;
          return acc;
        }, {} as Record<string, string>),
        topic_analysis: result.topics,
        strengths: result.strengths,
        improvement_areas: result.improvementAreas,
        question_snapshots: questionSnapshots.length > 0 ? questionSnapshots : result.breakdown.map((b) => ({
          id: b.id,
          prompt: b.question,
          topicId: b.topicId,
          topicLabel: b.topicId,
          selectedAnswer: b.selectedAnswer,
          correctAnswer: b.correctAnswer,
          wasCorrect: b.isCorrect,
          explanation: b.explanation,
        })),
        recommendation: result.performanceTier,
      },
    });
  }

  // Build Personalized Recommendation
  const accuracy = Math.round(result.accuracy);
  let recommendationCopy = "";
  if (isEn) {
    if (accuracy >= 75) {
      recommendationCopy = `You demonstrated a strong command of core ${examCode} topics with a high diagnostic accuracy of %${accuracy}. To achieve a top-percentile official score, focus on high-difficulty edge cases and time optimization.`;
    } else if (accuracy >= 40) {
      recommendationCopy = `You have built a solid foundation in ${examCode} fundamentals. Targeted practice on your improvement topics will yield substantial score gains.`;
    } else {
      recommendationCopy = `This diagnostic highlights foundational concepts that require structured preparation. Our specialized 1-on-1 methodology will help you master each topic systematically.`;
    }
  } else {
    if (accuracy >= 75) {
      recommendationCopy = `%${accuracy} başarı oranı ile ${examCode} sınavının temel konularında güçlü bir hakimiyet gösterdiniz. Hedefinizdeki en yüksek skor dilimine ulaşmak için ileri seviye soru tipleri ve zaman yönetimine odaklanabilirsiniz.`;
    } else if (accuracy >= 40) {
      recommendationCopy = `${examCode} sınavının temel kavramlarında sağlam bir başlangıç seviyesindesiniz. Belirlenen gelişim alanlarına yönelik odaklanmış çalışma ile puanınızı hızla yükseltebilirsiniz.`;
    } else {
      recommendationCopy = `Bu deneme analizi, yapılandırılmış bir akademik hazırlık gerektiren temel konuları ortaya koymaktadır. Birebir eğitim yaklaşımımızla eksiklerinizi sistemli bir şekilde tamamlayabilirsiniz.`;
    }
  }

  // Construct Email HTML
  const greeting = fullName
    ? (isEn ? `Hello ${fullName},` : `Merhaba ${fullName},`)
    : (isEn ? "Hello," : "Merhaba,");

  const subject = isEn
    ? `${examCode} Exam Analysis | Oriens Academy`
    : `${examCode} Sınav Analiziniz Hazır | Oriens Academy`;

  const bookingUrl = isEn
    ? "https://oriens-academy.com/en/booking"
    : "https://oriens-academy.com/tr/randevu";

  const portalUrl = isEn
    ? "https://oriens-academy.com/en/account"
    : "https://oriens-academy.com/tr/hesabim";

  // Build Questions HTML snippet
  const questionsList = (questionSnapshots.length > 0 ? questionSnapshots : result.breakdown.map((b) => ({
    id: b.id,
    prompt: b.question,
    topicLabel: b.topicId,
    selectedAnswer: b.selectedAnswer,
    correctAnswer: b.correctAnswer,
    wasCorrect: b.isCorrect,
    explanation: b.explanation,
  }))).map((q, idx) => `
    <div style="background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; margin-bottom: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 12px; font-weight: 700; color: #111827;">${isEn ? `Question ${idx + 1}` : `Soru ${idx + 1}`} · <span style="color: #6B7280; font-weight: 500;">${q.topicLabel}</span></span>
        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; ${q.wasCorrect ? 'background: #ECFDF5; color: #065F46;' : 'background: #FEF2F2; color: #991B1B;'}">
          ${q.wasCorrect ? (isEn ? '✓ Correct' : '✓ Doğru') : (isEn ? '✕ Incorrect' : '✕ Yanlış')}
        </span>
      </div>
      <p style="font-size: 13px; color: #374151; margin: 0 0 8px; line-height: 1.4;">${q.prompt}</p>
      <div style="font-size: 12px; color: #4B5563; background: #F9FAFB; padding: 8px 10px; border-radius: 6px; margin-bottom: 8px;">
        <div><strong>${isEn ? 'Your Answer:' : 'Verdiğiniz Cevap:'}</strong> <span style="${q.wasCorrect ? 'color: #059669; font-weight: 600;' : 'color: #DC2626; font-weight: 600;'}">${q.selectedAnswer || (isEn ? 'Unanswered' : 'Boş')}</span></div>
        ${!q.wasCorrect ? `<div><strong>${isEn ? 'Correct Answer:' : 'Doğru Cevap:'}</strong> <span style="color: #059669; font-weight: 600;">${q.correctAnswer}</span></div>` : ''}
      </div>
      ${q.explanation ? `<div style="font-size: 11px; color: #6B7280; line-height: 1.4; border-top: 1px dashed #E5E7EB; pt: 6px; margin-top: 6px;"><strong>${isEn ? 'Explanation:' : 'Çözüm Açıklaması:'}</strong> ${q.explanation}</div>` : ''}
    </div>
  `).join("");

  // Build Topics HTML snippet
  const topicsList = (result.topics || []).map((t) => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F3F4F6;">
      <span style="font-size: 13px; font-weight: 600; color: #1F2937;">${t.label}</span>
      <div style="text-align: right;">
        <span style="font-size: 12px; font-weight: 700; color: ${t.accuracy >= 75 ? '#059669' : t.accuracy >= 50 ? '#D97706' : '#DC2626'};">%${t.accuracy}</span>
        <span style="font-size: 11px; color: #6B7280; margin-left: 4px;">(${t.correct}/${t.total})</span>
      </div>
    </div>
  `).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${subject}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8F9FA; margin: 0; padding: 30px 15px;">
  <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 14px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    
    <!-- Branding Header -->
    <div style="margin-bottom: 24px; border-bottom: 1px solid #E5E7EB; pb: 18px;">
      <span style="font-size: 11px; font-weight: 700; color: #1E3A2B; letter-spacing: 0.15em; text-transform: uppercase;">ORIENS ACADEMY</span>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 6px 0 0;">${isEn ? `${examCode} Diagnostic Report` : `${examCode} Deneme Analiz Raporu`}</h1>
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #374151; margin-bottom: 20px;">
      ${greeting}<br>
      ${isEn ? `Here is your detailed diagnostic breakdown for the ${examCode} assessment you completed on Oriens Academy:` : `Oriens Academy üzerinde tamamladığınız ${examCode} Kendini Dene sınavı için ayrıntılı performans raporunuz hazırlanmıştır:`}
    </p>

    <!-- Score Summary Card -->
    <div style="background-color: #1E3A2B; color: #FFFFFF; border-radius: 12px; padding: 22px; margin-bottom: 26px; text-align: center;">
      <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.12em; color: rgba(255,255,255,0.75);">${isEn ? "Diagnostic Score" : "Deneme Başarı Skoru"}</span>
      <div style="font-size: 38px; font-weight: 800; margin: 8px 0; color: #FFFFFF;">
        %${accuracy}
      </div>
      <div style="font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 500;">
        ${result.correct} / ${result.total} ${isEn ? "Correct" : "Doğru"} · ${result.incorrect} ${isEn ? "Incorrect" : "Yanlış"} ${result.unanswered > 0 ? `· ${result.unanswered} ${isEn ? "Unanswered" : "Boş"}` : ""}
      </div>
    </div>

    <!-- Personalized Recommendation Box -->
    <div style="background-color: #F4F6F0; border-left: 4px solid #1E3A2B; border-radius: 4px 8px 8px 4px; padding: 16px; margin-bottom: 26px;">
      <h4 style="margin: 0 0 6px; font-size: 13px; font-weight: 700; color: #1E3A2B;">${isEn ? "Academic Recommendation" : "Size Özel Akademik Önerimiz"}</h4>
      <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">${recommendationCopy}</p>
    </div>

    <!-- Topic Breakdown Section -->
    <div style="margin-bottom: 26px;">
      <h3 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 12px;">${isEn ? "Topic Mastery Breakdown" : "Konu Bazlı Başarı Analizi"}</h3>
      <div style="background: #FAFAFA; border: 1px solid #E5E7EB; border-radius: 8px; padding: 12px 16px;">
        ${topicsList}
      </div>
    </div>

    <!-- Question-by-Question Section -->
    <div style="margin-bottom: 28px;">
      <h3 style="font-size: 15px; font-weight: 700; color: #111827; margin: 0 0 14px;">${isEn ? "Question-by-Question Solutions" : "Soru ve Çözüm Detayları"}</h3>
      ${questionsList}
    </div>

    <!-- CTA & Consultation Banner -->
    <div style="background-color: #F9FAF8; border: 1px solid #E2E8F0; border-radius: 12px; padding: 22px; text-align: center; margin-top: 24px;">
      <h4 style="margin: 0 0 8px; font-size: 16px; font-weight: 700; color: #111827;">${isEn ? "Targeting Top Global Universities?" : "Hedeflediğiniz Üniversiteye Birlikte Ulaşalım"}</h4>
      <p style="margin: 0 0 16px; font-size: 13px; color: #4B5563; line-height: 1.5;">
        ${isEn ? "Schedule a free consultation with our academic advisors to build your personalized study roadmap." : "Akademik danışmanlarımızla ücretsiz birebir ön görüşme planlayarak sonuçlarınızı değerlendirin ve çalışma haritanızı oluşturun."}
      </p>
      <a href="${bookingUrl}" style="display: inline-block; background-color: #1E3A2B; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 26px; border-radius: 8px;">
        ${isEn ? "Request Free Consultation" : "Ücretsiz Ön Görüşme Talep Et"}
      </a>
    </div>

    <!-- Footer -->
    <p style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #F3F4F6; font-size: 11px; color: #9CA3AF; line-height: 1.5; text-align: center;">
      Oriens Academy · Uluslararası Sınav Hazırlığı & Akademik Danışmanlık<br>
      <a href="${portalUrl}" style="color: #6B7280; text-decoration: underline;">oriens-academy.com</a>
    </p>
  </div>
</body>
</html>
  `.trim();

  const text = `
ORIENS ACADEMY
${subject}

${greeting}

${isEn ? `Your ${examCode} diagnostic score:` : `${examCode} Deneme Başarı Skoru:`} %${accuracy} (${result.correct}/${result.total})

${isEn ? "Academic Recommendation:" : "Akademik Önerimiz:"}
${recommendationCopy}

${isEn ? "Request a free consultation:" : "Ücretsiz ön görüşme talep edin:"} ${bookingUrl}
  `.trim();

  const delivery = await sendTransactionalEmail({
    supabaseAdmin: admin,
    to: email,
    replyTo: "contact@oriens-academy.com",
    channel: "general",
    sender: { name: "Oriens Academy", email: "info@oriens-academy.com" },
    subject,
    html,
    text,
    eventType: "exam.result_email_sent",
    entityType: "exam_result",
    entityId: `${examCode}-${email}-${Date.now()}`,
    idempotencyKey: `exam-res-${examCode}-${email}-${Date.now()}`,
  });

  return buildJsonResponse(
    {
      success: true,
      claimToken,
      delivery,
    },
    200,
    req
  );
});
