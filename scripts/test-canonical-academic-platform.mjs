import assert from "node:assert/strict";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(fs.readFileSync(".env.local","utf8").split(/\r?\n/)
  .filter((line)=>line && !line.startsWith("#") && line.includes("="))
  .map((line)=>{const i=line.indexOf("=");return [line.slice(0,i),line.slice(i+1).replace(/^['"]|['"]$/g,"")];}));
const service=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const anon=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const count=async(table,filter=(q)=>q)=>{const {count,error}=await filter(service.from(table).select("*",{count:"exact",head:true}));if(error)throw error;return count??0;};
// Baseline after the approved exact paymentv6 test-account cleanup migration.
const protectedBefore={student_profiles:3,payment_transactions:10,pricing_packages:6,student_lessons:0,student_package_purchases:9};
const protectedAfter=Object.fromEntries(await Promise.all(Object.keys(protectedBefore).map(async(table)=>[table,await count(table)])));
assert.deepEqual(protectedAfter,protectedBefore,"protected business row counts changed");

const {data:exams,error:examError}=await service.from("exams").select("code,canonical_name,supported_public,active,display_order").eq("active",true).eq("supported_public",true).order("display_order");
if(examError)throw examError;assert.equal(exams.length,18);assert.equal(exams.find(e=>e.code==="TARA").canonical_name,"Test of Academic Reasoning for Admissions");
assert.equal(exams.find(e=>e.code==="UCAT").canonical_name,"University Clinical Aptitude Test");
const {data:legacyAlias,error:aliasError}=await service.from("exam_aliases").select("exam_id,exams!inner(code),alias_type").eq("normalized_alias","ukcat").eq("active",true);
if(aliasError)throw aliasError;assert.equal(legacyAlias.length,1);assert.equal(legacyAlias[0].exams.code,"UCAT");assert.equal(legacyAlias[0].alias_type,"legacy");
assert.equal(await count("exam_practice_questions",q=>q.eq("active",true)),90);
const {data:questionCounts,error:questionError}=await service.from("exam_practice_questions").select("exam_id,topic,question,source_type,exams!inner(code)").eq("active",true);
if(questionError)throw questionError;const perExam=Object.groupBy(questionCounts,q=>q.exams.code);for(const exam of exams)assert.equal(perExam[exam.code]?.length,6,`${exam.code} question count`);
assert.ok(!JSON.stringify(perExam.TARA).toLowerCase().includes("architecture"));assert.ok(!JSON.stringify(perExam.UCAT).toLowerCase().includes("abstract reasoning"));

const universityCounts={
  totalActive:await count("universities",q=>q.eq("active",true)),
  eligible:await count("universities",q=>q.eq("active",true).eq("eligibility_status","eligible")),
  needsReview:await count("universities",q=>q.eq("active",true).eq("eligibility_status","needs_review")),
  ineligible:await count("universities",q=>q.eq("active",true).eq("eligibility_status","ineligible")),
  countries:await count("countries",q=>q.eq("active",true)),
};
assert.equal(universityCounts.eligible+universityCounts.needsReview+universityCounts.ineligible,universityCounts.totalActive);
const {data:badIB,error:badIBError}=await service.from("universities").select("eligibility_status").eq("normalized_name","international baccalaureate");if(badIBError)throw badIBError;assert.ok(badIB.every(row=>row.eligibility_status!=="eligible"));

const searchCases={"IB":"International Baccalaureate (IB)","International Baccalaureate":"International Baccalaureate (IB)","A Level":"A-Level","A-Level":"A-Level","UKCAT":"UCAT","Cambdrige":"University of Cambridge","Oxfrod":"University of Oxford","Standford":"Stanford University","Harward":"Harvard University","Bokoni":"Bocconi University","Oxford":"University of Oxford","Cambridge":"University of Cambridge","MIT":"Massachusetts Institute of Technology","Tokyo":"The University of Tokyo","Cape Town":"University of Cape Town","São Paulo":"Universidade de São Paulo","Istanbul Technical University":"Istanbul Technical University","NUS":"National University of Singapore"};
const searchResults={};const latencies=[];let timeouts=0;
for(const query of Object.keys(searchCases)) await service.rpc("search_autocomplete_entities",{p_query:query,p_limit:5});
for(const [query,expected] of Object.entries(searchCases)){
  const started=performance.now();const {data,error}=await service.rpc("search_autocomplete_entities",{p_query:query,p_limit:5});const ms=performance.now()-started;latencies.push(ms);
  if(error){timeouts++;throw new Error(`${query}: ${error.message}`);}const titles=data.map(row=>row.title);assert.ok(titles.includes(expected),`${query}: expected ${expected}; got ${titles.join(", ")}`);
  if(query==="Cape Town")assert.equal(data.filter(r=>r.entity_type==="UNIVERSITY")[0]?.title,"University of Cape Town");
  if(query==="International Baccalaureate")assert.equal(data.filter(r=>r.entity_type==="UNIVERSITY").some(r=>r.title==="International Baccalaureate"),false);
  searchResults[query]={top:data[0]?.title,top5:titles,ms:Number(ms.toFixed(1))};
}
latencies.sort((a,b)=>a-b);const percentile=(p)=>latencies[Math.min(latencies.length-1,Math.ceil(latencies.length*p)-1)];

for(const iso3 of ["GBR","USA","FRA","ITA","DEU","EGY","JPN","BRA","ZAF","AUS","IND","TUR"]){
  const {data,error}=await service.rpc("get_featured_universities_by_country",{p_iso3:iso3});if(error)throw error;assert.ok(data.length<=3,`${iso3} over three`);assert.ok(data.every(row=>row.country_iso3===iso3),`${iso3} cross-country leak`);
}
const requirements={verified:await count("university_admission_requirements",q=>q.eq("verification_status","verified")),needsReview:await count("university_admission_requirements",q=>q.eq("verification_status","needs_review"))};
const missingFk=await count("university_admission_requirements",q=>q.is("exam_id",null));assert.equal(missingFk,0);
const overlayCount=await count("country_featured_universities",q=>q.eq("active",true));
const {count:anonExamCount,error:anonExamError}=await anon.from("exams").select("*",{count:"exact",head:true});if(anonExamError)throw anonExamError;assert.equal(anonExamCount,18);
const {data:anonRequirements,error:anonReqError}=await anon.from("university_admission_requirements").select("verification_status,expires_at");if(anonReqError)throw anonReqError;assert.ok(anonRequirements.every(r=>r.verification_status==="verified" && (!r.expires_at || new Date(r.expires_at)>=new Date())));

const output={protectedAfter,exams:exams.length,questions:questionCounts.length,universityCounts,searchResults,latency:{p50:Number(percentile(.5).toFixed(1)),p95:Number(percentile(.95).toFixed(1)),p99:Number(percentile(.99).toFixed(1)),timeouts},featured:{countryIsolation:"PASS",max3:"PASS",overlayCount},requirements,rls:"PASS"};
fs.writeFileSync(".canonical-academic-qa.json",JSON.stringify(output,null,2));console.log(JSON.stringify(output));
