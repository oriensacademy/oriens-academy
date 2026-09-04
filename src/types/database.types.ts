export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      admin_profiles: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      guardian_accounts: {
        Row: { user_id: string; full_name: string; email: string; phone: string | null; contact_address: string | null; preferred_language: string; email_verified_at: string | null; active: boolean; migration_source: string; created_at: string; updated_at: string }
        Insert: { user_id: string; full_name: string; email: string; phone?: string | null; contact_address?: string | null; preferred_language?: string; email_verified_at?: string | null; active?: boolean; migration_source?: string; created_at?: string; updated_at?: string }
        Update: { full_name?: string; phone?: string | null; contact_address?: string | null; preferred_language?: string; active?: boolean; updated_at?: string }
        Relationships: []
      }
      guardian_students: {
        Row: { guardian_user_id: string; student_id: string; relationship_role: string; is_primary: boolean; active: boolean; source: string; created_at: string; updated_at: string }
        Insert: { guardian_user_id: string; student_id: string; relationship_role?: string; is_primary?: boolean; active?: boolean; source?: string; created_at?: string; updated_at?: string }
        Update: { relationship_role?: string; is_primary?: boolean; active?: boolean; updated_at?: string }
        Relationships: []
      }
      countries: {
        Row: {
          active: boolean
          aliases: string[]
          created_at: string
          id: string
          iso2: string
          iso3: string
          name: string
          region: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          created_at?: string
          id?: string
          iso2: string
          iso3: string
          name: string
          region?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          created_at?: string
          id?: string
          iso2?: string
          iso3?: string
          name?: string
          region?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      universities: {
        Row: {
          active: boolean
          admissions_url: string | null
          city: string | null
          country_id: string
          created_at: string
          id: string
          institution_type: string
          logo_url: string | null
          name: string
          normalized_name: string
          popularity_score: number | null
          ranking_value: number | null
          slug: string
          state_or_region: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          active?: boolean
          admissions_url?: string | null
          city?: string | null
          country_id: string
          created_at?: string
          id?: string
          institution_type?: string
          logo_url?: string | null
          name: string
          normalized_name: string
          popularity_score?: number | null
          ranking_value?: number | null
          slug: string
          state_or_region?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          active?: boolean
          admissions_url?: string | null
          city?: string | null
          country_id?: string
          created_at?: string
          id?: string
          institution_type?: string
          logo_url?: string | null
          name?: string
          normalized_name?: string
          popularity_score?: number | null
          ranking_value?: number | null
          slug?: string
          state_or_region?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "universities_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          }
        ]
      }
      fields_of_study: {
        Row: {
          active: boolean
          aliases: string[]
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          aliases?: string[]
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          aliases?: string[]
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fields_of_study_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "fields_of_study"
            referencedColumns: ["id"]
          }
        ]
      }
      programs: {
        Row: {
          active: boolean
          application_url: string | null
          campus: string | null
          country_id: string | null
          created_at: string
          degree_level: string
          degree_title: string | null
          data_quality_reason: string | null
          data_quality_signals: Json
          data_quality_status: string
          duration: string | null
          duration_unit: string | null
          duration_value: number | null
          faculty: string | null
          faculty_or_department: string | null
          field_of_study: string | null
          field_of_study_id: string | null
          id: string
          language: string
          name: string
          normalized_name: string
          official_program_url: string | null
          reviewed_at: string | null
          slug: string
          source_id: string | null
          study_mode: string | null
          university_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          application_url?: string | null
          campus?: string | null
          country_id?: string | null
          created_at?: string
          degree_level?: string
          degree_title?: string | null
          data_quality_reason?: string | null
          data_quality_signals?: Json
          data_quality_status?: string
          duration?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          faculty?: string | null
          faculty_or_department?: string | null
          field_of_study?: string | null
          field_of_study_id?: string | null
          id?: string
          language?: string
          name: string
          normalized_name: string
          official_program_url?: string | null
          reviewed_at?: string | null
          slug: string
          source_id?: string | null
          study_mode?: string | null
          university_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          application_url?: string | null
          campus?: string | null
          country_id?: string | null
          created_at?: string
          degree_level?: string
          degree_title?: string | null
          data_quality_reason?: string | null
          data_quality_signals?: Json
          data_quality_status?: string
          duration?: string | null
          duration_unit?: string | null
          duration_value?: number | null
          faculty?: string | null
          faculty_or_department?: string | null
          field_of_study?: string | null
          field_of_study_id?: string | null
          id?: string
          language?: string
          name?: string
          normalized_name?: string
          official_program_url?: string | null
          reviewed_at?: string | null
          slug?: string
          source_id?: string | null
          study_mode?: string | null
          university_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_field_of_study_id_fkey"
            columns: ["field_of_study_id"]
            isOneToOne: false
            referencedRelation: "fields_of_study"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_programs_source_id"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "admission_sources"
            referencedColumns: ["id"]
          }
        ]
      }
      program_quality_audits: {
        Row: {
          audited_at: string
          classification: string
          evidence: Json
          id: string
          previous_active: boolean
          program_id: string
          reason: string
          run_label: string
        }
        Insert: {
          audited_at?: string
          classification: string
          evidence?: Json
          id?: string
          previous_active: boolean
          program_id: string
          reason: string
          run_label: string
        }
        Update: {
          audited_at?: string
          classification?: string
          evidence?: Json
          id?: string
          previous_active?: boolean
          program_id?: string
          reason?: string
          run_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_quality_audits_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          }
        ]
      }
      program_external_identifiers: {
        Row: {
          created_at: string
          external_id: string
          id: string
          metadata: Json
          program_id: string
          source_type: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_id: string
          id?: string
          metadata?: Json
          program_id: string
          source_type: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_id?: string
          id?: string
          metadata?: Json
          program_id?: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_external_identifiers_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          }
        ]
      }
      qualifications: {
        Row: {
          active: boolean
          category: string
          code: string
          country_scope: string | null
          created_at: string
          description: string | null
          id: string
          maximum_possible_score: number | null
          minimum_possible_score: number | null
          name: string
          official_url: string | null
          score_type: string | null
          short_name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          country_scope?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maximum_possible_score?: number | null
          minimum_possible_score?: number | null
          name: string
          official_url?: string | null
          score_type?: string | null
          short_name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          country_scope?: string | null
          created_at?: string
          description?: string | null
          id?: string
          maximum_possible_score?: number | null
          minimum_possible_score?: number | null
          name?: string
          official_url?: string | null
          score_type?: string | null
          short_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admission_sources: {
        Row: {
          academic_year: number
          active: boolean
          canonical_url: string | null
          content_hash: string | null
          created_at: string
          http_status: number | null
          id: string
          is_official: boolean
          language: string | null
          page_title: string | null
          program_id: string | null
          publisher: string | null
          retrieved_at: string
          source_type: string
          title: string
          university_id: string | null
          updated_at: string
          url: string
          verified_at: string
        }
        Insert: {
          academic_year?: number
          active?: boolean
          canonical_url?: string | null
          content_hash?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          is_official?: boolean
          language?: string | null
          page_title?: string | null
          program_id?: string | null
          publisher?: string | null
          retrieved_at?: string
          source_type: string
          title: string
          university_id?: string | null
          updated_at?: string
          url: string
          verified_at?: string
        }
        Update: {
          academic_year?: number
          active?: boolean
          canonical_url?: string | null
          content_hash?: string | null
          created_at?: string
          http_status?: number | null
          id?: string
          is_official?: boolean
          language?: string | null
          page_title?: string | null
          program_id?: string | null
          publisher?: string | null
          retrieved_at?: string
          source_type?: string
          title?: string
          university_id?: string | null
          updated_at?: string
          url?: string
          verified_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_sources_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_sources_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          }
        ]
      }
      admission_source_snapshots: {
        Row: {
          content_hash: string
          created_at: string
          http_headers: Json
          id: string
          raw_payload: Json
          snapshot_excerpt: string | null
          source_id: string
        }
        Insert: {
          content_hash: string
          created_at?: string
          http_headers?: Json
          id?: string
          raw_payload?: Json
          snapshot_excerpt?: string | null
          source_id: string
        }
        Update: {
          content_hash?: string
          created_at?: string
          http_headers?: Json
          id?: string
          raw_payload?: Json
          snapshot_excerpt?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_source_snapshots_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "admission_sources"
            referencedColumns: ["id"]
          }
        ]
      }
      admission_requirement_groups: {
        Row: {
          created_at: string
          id: string
          logical_operator: string
          name: string | null
          parent_group_id: string | null
          program_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logical_operator?: string
          name?: string | null
          parent_group_id?: string | null
          program_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logical_operator?: string
          name?: string | null
          parent_group_id?: string | null
          program_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_requirement_groups_parent_group_id_fkey"
            columns: ["parent_group_id"]
            isOneToOne: false
            referencedRelation: "admission_requirement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirement_groups_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          }
        ]
      }
      admission_requirements: {
        Row: {
          academic_year: number
          admission_cycle: string
          applicant_country_id: string | null
          applicant_curriculum: string | null
          applicant_type: string
          created_at: string
          data_confidence: string
          effective_from: string | null
          effective_until: string | null
          exact_grade: string | null
          grade_text: string | null
          group_id: string
          id: string
          intake_term: string | null
          level_requirement: string | null
          maximum_numeric_score: number | null
          minimum_numeric_score: number | null
          minimum_score: number | null
          notes: string | null
          program_id: string | null
          qualification_id: string | null
          raw_evidence: Json
          recommended_numeric_score: number | null
          recommended_score: number | null
          requirement_status: string
          requirement_type: string
          source_id: string | null
          subject_id: string | null
          subject_minimum_score: string | null
          subject_name: string | null
          subject_requirement: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: number
          admission_cycle?: string
          applicant_country_id?: string | null
          applicant_curriculum?: string | null
          applicant_type?: string
          created_at?: string
          data_confidence?: string
          effective_from?: string | null
          effective_until?: string | null
          exact_grade?: string | null
          grade_text?: string | null
          group_id: string
          id?: string
          intake_term?: string | null
          level_requirement?: string | null
          maximum_numeric_score?: number | null
          minimum_numeric_score?: number | null
          minimum_score?: number | null
          notes?: string | null
          program_id?: string | null
          qualification_id?: string | null
          raw_evidence?: Json
          recommended_numeric_score?: number | null
          recommended_score?: number | null
          requirement_status?: string
          requirement_type?: string
          source_id?: string | null
          subject_id?: string | null
          subject_minimum_score?: string | null
          subject_name?: string | null
          subject_requirement?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: number
          admission_cycle?: string
          applicant_country_id?: string | null
          applicant_curriculum?: string | null
          applicant_type?: string
          created_at?: string
          data_confidence?: string
          effective_from?: string | null
          effective_until?: string | null
          exact_grade?: string | null
          grade_text?: string | null
          group_id?: string
          id?: string
          intake_term?: string | null
          level_requirement?: string | null
          maximum_numeric_score?: number | null
          minimum_numeric_score?: number | null
          minimum_score?: number | null
          notes?: string | null
          program_id?: string | null
          qualification_id?: string | null
          raw_evidence?: Json
          recommended_numeric_score?: number | null
          recommended_score?: number | null
          requirement_status?: string
          requirement_type?: string
          source_id?: string | null
          subject_id?: string | null
          subject_minimum_score?: string | null
          subject_name?: string | null
          subject_requirement?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admission_requirements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "admission_requirement_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirements_qualification_id_fkey"
            columns: ["qualification_id"]
            isOneToOne: false
            referencedRelation: "qualifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirements_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "admission_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirements_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "fields_of_study"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_requirements_applicant_country_id_fkey"
            columns: ["applicant_country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          }
        ]
      }
      university_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_primary: boolean
          root_domain: string
          source_url: string | null
          university_id: string
          updated_at: string
          verification_method: string | null
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_primary?: boolean
          root_domain: string
          source_url?: string | null
          university_id: string
          updated_at?: string
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_primary?: boolean
          root_domain?: string
          source_url?: string | null
          university_id?: string
          updated_at?: string
          verification_method?: string | null
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "university_domains_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          }
        ]
      }
      university_source_registry: {
        Row: {
          canonical_url: string | null
          content_type: string
          created_at: string
          discovered_at: string
          domain: string | null
          http_status: number | null
          id: string
          is_official: boolean
          language: string | null
          last_checked_at: string | null
          metadata: Json
          notes: string | null
          page_title: string | null
          priority: number
          provenance_type: string
          source_type: string
          status: string
          university_id: string
          updated_at: string
          url: string
          verification_status: string
        }
        Insert: {
          canonical_url?: string | null
          content_type?: string
          created_at?: string
          discovered_at?: string
          domain?: string | null
          http_status?: number | null
          id?: string
          is_official?: boolean
          language?: string | null
          last_checked_at?: string | null
          metadata?: Json
          notes?: string | null
          page_title?: string | null
          priority?: number
          provenance_type?: string
          source_type: string
          status?: string
          university_id: string
          updated_at?: string
          url: string
          verification_status?: string
        }
        Update: {
          canonical_url?: string | null
          content_type?: string
          created_at?: string
          discovered_at?: string
          domain?: string | null
          http_status?: number | null
          id?: string
          is_official?: boolean
          language?: string | null
          last_checked_at?: string | null
          metadata?: Json
          notes?: string | null
          page_title?: string | null
          priority?: number
          provenance_type?: string
          source_type?: string
          status?: string
          university_id?: string
          updated_at?: string
          url?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "university_source_registry_university_id_fkey"
            columns: ["university_id"]
            isOneToOne: false
            referencedRelation: "universities"
            referencedColumns: ["id"]
          }
        ]
      }
      ingestion_runs: {
        Row: {
          created_at: string
          error_summary: Json
          finished_at: string | null
          id: string
          records_discovered: number
          records_failed: number
          records_inserted: number
          records_skipped: number
          records_updated: number
          run_type: string
          source: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_summary?: Json
          finished_at?: string | null
          id?: string
          records_discovered?: number
          records_failed?: number
          records_inserted?: number
          records_skipped?: number
          records_updated?: number
          run_type: string
          source: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_summary?: Json
          finished_at?: string | null
          id?: string
          records_discovered?: number
          records_failed?: number
          records_inserted?: number
          records_skipped?: number
          records_updated?: number
          run_type?: string
          source?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      search_aliases: {
        Row: {
          alias: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          language: string
          normalized_alias: string
          priority: number
          source: string
          updated_at: string
        }
        Insert: {
          alias: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          language?: string
          normalized_alias: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Update: {
          alias?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          language?: string
          normalized_alias?: string
          priority?: number
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json | null
        }
        Relationships: []
      }
      availability_slots: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string
          id: string
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string
          id?: string
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          created_at: string
          custom_exam: string | null
          email: string
          exam_code: string | null
          full_name: string
          id: string
          locale: string
          marketing_consent: boolean
          notes: string | null
          phone: string | null
          privacy_consent: boolean
          slot_id: string | null
          source: string | null
          status: string
          student_user_id: string | null
          appointment_subject: string | null
          event_type: string
          live_meeting_url: string | null
          meeting_link_sent_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          custom_exam?: string | null
          email: string
          exam_code?: string | null
          full_name: string
          id?: string
          locale?: string
          marketing_consent?: boolean
          notes?: string | null
          phone?: string | null
          privacy_consent?: boolean
          slot_id?: string | null
          source?: string | null
          status?: string
          student_user_id?: string | null
          appointment_subject?: string | null
          event_type?: string
          live_meeting_url?: string | null
          meeting_link_sent_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          custom_exam?: string | null
          email?: string
          exam_code?: string | null
          full_name?: string
          id?: string
          locale?: string
          marketing_consent?: boolean
          notes?: string | null
          phone?: string | null
          privacy_consent?: boolean
          slot_id?: string | null
          source?: string | null
          status?: string
          student_user_id?: string | null
          appointment_subject?: string | null
          event_type?: string
          live_meeting_url?: string | null
          meeting_link_sent_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          }
        ]
      }
      contact_requests: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          locale: string
          message: string
          metadata: Json
          phone: string | null
          privacy_consent: boolean
          source: string
          status: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name: string
          id?: string
          locale?: string
          message: string
          metadata?: Json
          phone?: string | null
          privacy_consent?: boolean
          source?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          locale?: string
          message?: string
          metadata?: Json
          phone?: string | null
          privacy_consent?: boolean
          source?: string
          status?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_replies: {
        Row: {
          id: string
          contact_request_id: string
          direction: string
          sender_email: string
          recipient_email: string
          sender_name: string
          message_text: string
          message_html: string | null
          external_message_id: string | null
          delivery_status: string
          sent_by_admin_user_id: string | null
          idempotency_key: string
          error_metadata: Json | null
          created_at: string
          sent_at: string | null
        }
        Insert: {
          id?: string
          contact_request_id: string
          direction: string
          sender_email: string
          recipient_email: string
          sender_name: string
          message_text: string
          message_html?: string | null
          external_message_id?: string | null
          delivery_status?: string
          sent_by_admin_user_id?: string | null
          idempotency_key: string
          error_metadata?: Json | null
          created_at?: string
          sent_at?: string | null
        }
        Update: {
          external_message_id?: string | null
          delivery_status?: string
          error_metadata?: Json | null
          sent_at?: string | null
        }
        Relationships: []
      }
      notification_deliveries: {
        Row: {
          attempt_count: number
          channel: string
          created_at: string
          entity_id: string
          entity_type: string
          event_type: string
          id: string
          last_error_code: string | null
          provider: string
          provider_message_id: string | null
          recipient: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempt_count?: number
          channel?: string
          created_at?: string
          entity_id: string
          entity_type: string
          event_type: string
          id?: string
          last_error_code?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempt_count?: number
          channel?: string
          created_at?: string
          entity_id?: string
          entity_type?: string
          event_type?: string
          id?: string
          last_error_code?: string | null
          provider?: string
          provider_message_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: { id: string; full_name: string; email: string; phone: string | null; date_of_birth: string | null; preferred_language: string; school: string | null; target_country: string | null; target_countries: string[]; target_university: string | null; target_exam: string | null; target_exams: string[]; onboarding_completed: boolean; active: boolean; created_at: string; updated_at: string }
        Insert: { id: string; full_name: string; email: string; phone?: string | null; date_of_birth?: string | null; preferred_language?: string; school?: string | null; target_country?: string | null; target_countries?: string[]; target_university?: string | null; target_exam?: string | null; target_exams?: string[]; onboarding_completed?: boolean; active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: string; full_name?: string; email?: string; phone?: string | null; date_of_birth?: string | null; preferred_language?: string; school?: string | null; target_country?: string | null; target_countries?: string[]; target_university?: string | null; target_exam?: string | null; target_exams?: string[]; onboarding_completed?: boolean; active?: boolean; created_at?: string; updated_at?: string }
        Relationships: []
      }
      student_admin_notes: {
        Row: { id: string; student_user_id: string; note: string; created_by: string; created_at: string; updated_at: string }
        Insert: { id?: string; student_user_id: string; note: string; created_by: string; created_at?: string; updated_at?: string }
        Update: { id?: string; student_user_id?: string; note?: string; created_by?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      student_lessons: {
        Row: { id: string; student_user_id: string; booking_id: string | null; package_purchase_id: string | null; title: string; subject: string; exam_code: string | null; lesson_date: string; duration_minutes: number; status: string; teacher_note: string | null; live_meeting_url: string | null; meeting_link_sent_at: string | null; completed_at: string | null; completion_key: string | null; completion_source: string | null; completion_previous_remaining: number | null; created_at: string; updated_at: string }
        Insert: { id?: string; student_user_id: string; booking_id?: string | null; package_purchase_id?: string | null; title?: string; subject?: string; exam_code?: string | null; lesson_date?: string; duration_minutes?: number; status?: string; teacher_note?: string | null; live_meeting_url?: string | null; meeting_link_sent_at?: string | null; completed_at?: string | null; completion_key?: string | null; completion_source?: string | null; completion_previous_remaining?: number | null; created_at?: string; updated_at?: string }
        Update: { id?: string; student_user_id?: string; booking_id?: string | null; package_purchase_id?: string | null; title?: string; subject?: string; exam_code?: string | null; lesson_date?: string; duration_minutes?: number; status?: string; teacher_note?: string | null; live_meeting_url?: string | null; meeting_link_sent_at?: string | null; completed_at?: string | null; completion_key?: string | null; completion_source?: string | null; completion_previous_remaining?: number | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      student_homework: {
        Row: { id: string; student_user_id: string; lesson_id: string | null; title: string; description: string; due_date: string | null; status: string; submission_text: string | null; submitted_at: string | null; teacher_feedback: string | null; assignment_file_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; student_user_id: string; lesson_id?: string | null; title: string; description: string; due_date?: string | null; status?: string; submission_text?: string | null; submitted_at?: string | null; teacher_feedback?: string | null; assignment_file_url?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; student_user_id?: string; lesson_id?: string | null; title?: string; description?: string; due_date?: string | null; status?: string; submission_text?: string | null; submitted_at?: string | null; teacher_feedback?: string | null; assignment_file_url?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      discount_coupons: {
        Row: {
          id: string
          code: string
          name: string | null
          discount_type: string
          discount_value: number
          currency: string
          minimum_order_amount: number | null
          maximum_discount_amount: number | null
          max_total_uses: number | null
          max_uses_per_student: number | null
          used_count: number
          valid_from: string | null
          valid_until: string | null
          active: boolean
          first_purchase_only: boolean
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          code: string
          name?: string | null
          discount_type: string
          discount_value: number
          currency?: string
          minimum_order_amount?: number | null
          maximum_discount_amount?: number | null
          max_total_uses?: number | null
          max_uses_per_student?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          active?: boolean
          first_purchase_only?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          code?: string
          name?: string | null
          discount_type?: string
          discount_value?: number
          currency?: string
          minimum_order_amount?: number | null
          maximum_discount_amount?: number | null
          max_total_uses?: number | null
          max_uses_per_student?: number | null
          used_count?: number
          valid_from?: string | null
          valid_until?: string | null
          active?: boolean
          first_purchase_only?: boolean
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      discount_coupon_packages: {
        Row: {
          id: string
          coupon_id: string
          package_id: string
          created_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          package_id: string
          created_at?: string
        }
        Update: {
          id?: string
          coupon_id?: string
          package_id?: string
          created_at?: string
        }
        Relationships: []
      }
      discount_coupon_redemptions: {
        Row: {
          id: string
          coupon_id: string
          student_user_id: string
          payment_transaction_id: string
          package_purchase_id: string | null
          discount_amount: number
          redeemed_at: string
        }
        Insert: {
          id?: string
          coupon_id: string
          student_user_id: string
          payment_transaction_id: string
          package_purchase_id?: string | null
          discount_amount: number
          redeemed_at?: string
        }
        Update: {
          id?: string
          coupon_id?: string
          student_user_id?: string
          payment_transaction_id?: string
          package_purchase_id?: string | null
          discount_amount?: number
          redeemed_at?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          id: string
          student_user_id: string | null
          package_id: string
          public_reference: string
          status_token_hash: string
          provider: string
          provider_transaction_id: string | null
          amount: number
          currency: string
          status: string
          payment_method: string
          installment_count: number | null
          payer_name: string | null
          payer_email: string | null
          payer_phone: string | null
          payer_address: string | null
          purchaser_guardian_user_id: string | null
          package_owner_student_id: string | null
          auth_actor_user_id: string | null
          refunded_amount: number
          refund_status: string
          last_refunded_at: string | null
          last_refund_reason: string | null
          paytr_refund_reference: string | null
          metadata: Json
          created_at: string
          updated_at: string
          paid_at: string | null
          is_archived: boolean
          archived_at: string | null
          archive_reason: string | null
          is_preload: boolean
          checkout_idempotency_key: string | null
        }
        Insert: {
          id?: string
          student_user_id?: string | null
          package_id: string
          public_reference: string
          status_token_hash: string
          provider: string
          provider_transaction_id?: string | null
          amount: number
          currency: string
          status?: string
          payment_method: string
          installment_count?: number | null
          payer_name?: string | null
          payer_email?: string | null
          payer_phone?: string | null
          payer_address?: string | null
          purchaser_guardian_user_id?: string | null
          package_owner_student_id?: string | null
          auth_actor_user_id?: string | null
          refunded_amount?: number
          refund_status?: string
          last_refunded_at?: string | null
          last_refund_reason?: string | null
          paytr_refund_reference?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          paid_at?: string | null
          is_archived?: boolean
          archived_at?: string | null
          archive_reason?: string | null
          is_preload?: boolean
          checkout_idempotency_key?: string | null
        }
        Update: {
          id?: string
          student_user_id?: string | null
          package_id?: string
          public_reference?: string
          status_token_hash?: string
          provider?: string
          provider_transaction_id?: string | null
          amount?: number
          currency?: string
          status?: string
          payment_method?: string
          installment_count?: number | null
          payer_name?: string | null
          payer_email?: string | null
          payer_phone?: string | null
          payer_address?: string | null
          purchaser_guardian_user_id?: string | null
          package_owner_student_id?: string | null
          auth_actor_user_id?: string | null
          refunded_amount?: number
          refund_status?: string
          last_refunded_at?: string | null
          last_refund_reason?: string | null
          paytr_refund_reference?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
          paid_at?: string | null
          is_archived?: boolean
          archived_at?: string | null
          archive_reason?: string | null
          is_preload?: boolean
          checkout_idempotency_key?: string | null
        }
        Relationships: []
      }
      payment_refunds: {
        Row: {
          id: string
          payment_transaction_id: string
          package_purchase_id: string
          idempotency_key: string
          provider_reference: string
          requested_amount: number
          lesson_rights_to_revoke: number
          reason: string
          status: string
          provider_response: Json
          provider_error_code: string | null
          provider_error_message: string | null
          provider_call_started_at: string | null
          provider_succeeded_at: string | null
          finalized_at: string | null
          failed_at: string | null
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          payment_transaction_id: string
          package_purchase_id: string
          idempotency_key: string
          provider_reference: string
          requested_amount: number
          lesson_rights_to_revoke: number
          reason: string
          status?: string
          provider_response?: Json
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_call_started_at?: string | null
          provider_succeeded_at?: string | null
          finalized_at?: string | null
          failed_at?: string | null
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          provider_response?: Json
          provider_error_code?: string | null
          provider_error_message?: string | null
          provider_call_started_at?: string | null
          provider_succeeded_at?: string | null
          finalized_at?: string | null
          failed_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      student_package_purchases: {
        Row: {
          id: string
          student_user_id: string | null
          package_id: string
          payment_transaction_id: string | null
          lesson_count: number
          lessons_used: number
          start_date: string
          end_date: string | null
          status: string
          created_at: string
          price_amount: number | null
          currency: string
          payment_status: string
          assignment_source: string
          assigned_by: string | null
          updated_at: string
        }
        Insert: {
          id?: string
          student_user_id?: string | null
          package_id: string
          payment_transaction_id?: string | null
          lesson_count: number
          lessons_used?: number
          start_date?: string
          end_date?: string | null
          status?: string
          created_at?: string
          price_amount?: number | null
          currency?: string
          payment_status?: string
          assignment_source?: string
          assigned_by?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          student_user_id?: string | null
          package_id?: string
          payment_transaction_id?: string | null
          lesson_count?: number
          lessons_used?: number
          start_date?: string
          end_date?: string | null
          status?: string
          created_at?: string
          price_amount?: number | null
          currency?: string
          payment_status?: string
          assignment_source?: string
          assigned_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      pricing_packages: {
        Row: {
          active: boolean
          billing_basis: string
          created_at: string
          currency: string
          current_total: number | null
          description_en: string | null
          description_tr: string | null
          discount_percentage: number | null
          display_order: number
          featured: boolean
          id: string
          badge_en: string | null
          badge_tr: string | null
          lesson_count: number | null
          name_en: string | null
          name_tr: string | null
          old_total: number | null
          price_amount: number | null
          purchase_mode: string
          unit_price: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          billing_basis: string
          created_at?: string
          currency?: string
          current_total?: number | null
          description_en?: string | null
          description_tr?: string | null
          discount_percentage?: number | null
          display_order?: number
          featured?: boolean
          id: string
          badge_en?: string | null
          badge_tr?: string | null
          lesson_count?: number | null
          name_en?: string | null
          name_tr?: string | null
          old_total?: number | null
          price_amount?: number | null
          purchase_mode?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          billing_basis?: string
          created_at?: string
          currency?: string
          current_total?: number | null
          description_en?: string | null
          description_tr?: string | null
          discount_percentage?: number | null
          display_order?: number
          featured?: boolean
          id?: string
          badge_en?: string | null
          badge_tr?: string | null
          lesson_count?: number | null
          name_en?: string | null
          name_tr?: string | null
          old_total?: number | null
          price_amount?: number | null
          purchase_mode?: string
          unit_price?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          active: boolean
          context: string | null
          created_at: string
          display_order: number
          exam_code: string | null
          featured: boolean
          id: string
          locale: string
          name: string
          profile_image_url: string | null
          quote: string
          updated_at: string
          updated_by: string | null
          verified: boolean
        }
        Insert: {
          active?: boolean
          context?: string | null
          created_at?: string
          display_order?: number
          exam_code?: string | null
          featured?: boolean
          id?: string
          locale?: string
          name: string
          profile_image_url?: string | null
          quote: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Update: {
          active?: boolean
          context?: string | null
          created_at?: string
          display_order?: number
          exam_code?: string | null
          featured?: boolean
          id?: string
          locale?: string
          name?: string
          profile_image_url?: string | null
          quote?: string
          updated_at?: string
          updated_by?: string | null
          verified?: boolean
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_name: string | null
          content: string
          content_json: Json | null
          cover_image_url: string | null
          created_at: string
          excerpt: string
          id: string
          locale: string
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          content: string
          content_json?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt: string
          id?: string
          locale: string
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          content?: string
          content_json?: Json | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string
          id?: string
          locale?: string
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_payment_agreements: {
        Args: { p_merchant_oid: string; p_legal_versions?: Json }
        Returns: boolean
      }
      expire_stale_card_payments: {
        Args: { p_threshold_minutes?: number }
        Returns: number
      }
      setup_account_learner: {
        Args: { p_full_name: string; p_email: string; p_phone?: string | null; p_school?: string | null; p_preferred_language?: string }
        Returns: Json
      }
      admin_record_completed_lesson: {
        Args: { p_student_id: string; p_lesson_date: string; p_duration_minutes: number; p_title: string; p_subject: string; p_teacher_note?: string | null; p_package_purchase_id?: string | null; p_existing_lesson_id?: string | null; p_completion_source?: string; p_idempotency_key?: string | null }
        Returns: Json
      }
      admin_get_payment_refund_context: { Args: { p_transaction_id: string }; Returns: Json }
      admin_create_payment_refund_intent: { Args: { p_transaction_id: string; p_refund_amount: number; p_lesson_rights_to_revoke: number; p_reason: string; p_idempotency_key: string }; Returns: Json }
      admin_complete_student_lesson: {
        Args: { p_lesson_id: string; p_package_purchase_id?: string | null; p_teacher_note?: string | null }
        Returns: Json
      }
      admin_complete_scheduled_event: {
        Args: { p_event_id: string; p_package_purchase_id?: string | null; p_teacher_note?: string | null }
        Returns: Json
      }
      update_guardian_profile: {
        Args: { p_full_name: string; p_phone?: string | null; p_contact_address?: string | null; p_preferred_language?: string }
        Returns: Json
      }
      admin_retry_email_notification: { Args: { p_delivery_id: string }; Returns: Json }
      admin_create_booking: {
        Args: {
          p_email: string
          p_ends_at: string
          p_exam: string
          p_full_name: string
          p_notes?: string
          p_phone: string
          p_privacy_consent: boolean
          p_starts_at: string
          p_status?: string
        }
        Returns: Json
      }
      admin_update_booking_status: {
        Args: { p_booking_id: string; p_notes?: string; p_status: string }
        Returns: Json
      }
      admin_update_student_profile: {
        Args: { p_student_id: string; p_full_name: string; p_phone?: string | null; p_school: string; p_target_exam: string; p_target_university: string; p_target_country: string; p_preferred_language: string; p_active: boolean }
        Returns: Json
      }
      admin_create_student_booking: {
        Args: { p_student_id: string; p_full_name: string; p_email: string; p_phone: string; p_exam: string; p_subject: string; p_starts_at: string; p_ends_at: string; p_privacy_consent: boolean; p_notes?: string; p_status?: string }
        Returns: Json
      }
      admin_assign_student_package: {
        Args: { p_student_id: string; p_package_id: string; p_start_date: string; p_end_date: string | null; p_lesson_count: number; p_price_amount: number; p_currency: string; p_payment_status?: string; p_payment_transaction_id?: string | null }
        Returns: Json
      }
      admin_complete_student_appointment: {
        Args: { p_booking_id: string; p_package_purchase_id: string | null; p_title: string; p_subject: string; p_exam_code: string; p_duration_minutes: number; p_teacher_note?: string }
        Returns: Json
      }
      admin_review_bank_transfer: {
        Args: { p_payment_id: string; p_decision: string }
        Returns: Json
      }
      validate_checkout_coupon: {
        Args: { p_code: string; p_package_id: string; p_student_user_id?: string | null }
        Returns: Json
      }
      create_student_checkout: {
        Args: {
          p_package_id: string
          p_payment_method: string
          p_student_user_id?: string | null
          p_coupon_code?: string | null
          p_payer_name?: string | null
          p_payer_email?: string | null
          p_payer_phone?: string | null
          p_locale?: string | null
          p_idempotency_key?: string | null
          p_provider?: string | null
          p_provider_transaction_id?: string | null
          p_status?: string | null
          p_paid_at?: string | null
        }
        Returns: Json
      }
      is_admin: { Args: never; Returns: boolean }
      reserve_booking_slot: {
        Args: {
          p_custom_exam?: string
          p_email: string
          p_exam_code?: string
          p_full_name: string
          p_locale?: string
          p_marketing_consent?: boolean
          p_notes?: string
          p_phone?: string
          p_privacy_consent?: boolean
          p_slot_id: string
          p_support_type?: string
        }
        Returns: Json
      }
      search_autocomplete_entities: {
        Args: {
          p_query: string
          p_limit?: number
        }
        Returns: {
          entity_id: string
          entity_type: string
          title: string
          subtitle: string
          slug: string
          match_layer: number
          score: number
          country_iso2: string
          country_name: string
          badge: string
          official_url: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
