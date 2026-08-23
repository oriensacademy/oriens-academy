import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { buildJsonResponse, validateMutationRequest } from "../_shared/cors.ts";
import { dispatchBookingEmails, dispatchAppointmentConfirmedEmails } from "../_shared/email/service.ts";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
Deno.serve(async(req:Request)=>{
  const invalid=validateMutationRequest(req,["POST"]);if(invalid)return invalid;
  const url=Deno.env.get("SUPABASE_URL")||"";const anon=Deno.env.get("SUPABASE_ANON_KEY")||"";const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";const authorization=req.headers.get("authorization")||"";
  if(!url||!anon||!service||!authorization)return buildJsonResponse({error_code:"SERVER_CONFIG_ERROR"},500,req);
  const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}}});
  const [{data:userData},{data:isAdmin,error:adminError}]=await Promise.all([caller.auth.getUser(),caller.rpc("is_admin")]);
  if(!userData.user||adminError||isAdmin!==true)return buildJsonResponse({error_code:"ADMIN_REQUIRED"},403,req);
  const body=await req.json().catch(()=>({}));const bookingId=String(body.bookingId||"");
  if(!UUID.test(bookingId))return buildJsonResponse({error_code:"INVALID_BOOKING"},400,req);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await admin.from("bookings").select("id,full_name,email,phone,exam_code,custom_exam,notes,status,student_user_id,live_meeting_url,availability_slots(starts_at,ends_at)").eq("id",bookingId).single();
  if(error||!data)return buildJsonResponse({error_code:"BOOKING_NOT_FOUND"},404,req);
  const slot=Array.isArray(data.availability_slots)?data.availability_slots[0]:data.availability_slots;
  const {data:profile}=await admin.from("student_profiles").select("preferred_language").eq("id",data.student_user_id).maybeSingle();
  const locale = profile?.preferred_language === "en" ? "en" : "tr";

  if (slot?.starts_at) {
    await dispatchAppointmentConfirmedEmails(admin, {
      appointmentId: data.id,
      studentName: data.full_name,
      studentEmail: data.email,
      lessonTitle: data.exam_code ? `Sınav Hazırlığı (${data.exam_code.toUpperCase()})` : (data.custom_exam || "Birebir Akademik Danışmanlık"),
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
      locationOrMeetingUrl: data.live_meeting_url || (locale === "en" ? "https://oriens-academy.com/en/account" : "https://oriens-academy.com/tr/hesabim"),
      notes: data.notes,
      locale,
    });
  } else {
    await dispatchBookingEmails(admin, {
      bookingId: data.id,
      fullName: data.full_name,
      email: data.email,
      phone: data.phone,
      supportType: "exam_preparation",
      examCode: data.exam_code,
      customExam: data.custom_exam,
      startsAt: null,
      endsAt: null,
      locale,
      notes: data.notes,
      status: data.status,
    });
  }

  return buildJsonResponse({success:true},200,req);
});
