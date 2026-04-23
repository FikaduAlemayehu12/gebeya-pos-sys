export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          balance: number
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          balance?: number
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          balance?: number
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_maintenance: {
        Row: {
          asset_id: string
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          maintenance_date: string
          maintenance_type: string
          next_due_date: string | null
          notes: string | null
          performed_by: string | null
          status: string
        }
        Insert: {
          asset_id: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          status?: string
        }
        Update: {
          asset_id?: string
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          maintenance_date?: string
          maintenance_type?: string
          next_due_date?: string | null
          notes?: string | null
          performed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_maintenance_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          accumulated_depreciation: number
          asset_code: string
          assigned_to: string | null
          attributes: Json | null
          branch_id: string | null
          category: string
          chassis_number: string | null
          condition: string
          created_at: string
          created_by: string | null
          current_value: number
          depreciation_method: string
          depreciation_rate: number
          description: string | null
          document_url: string | null
          engine_number: string | null
          id: string
          image_url: string | null
          insurance_expiry: string | null
          location: string | null
          manufacturer: string | null
          model: string | null
          name: string
          name_am: string | null
          next_maintenance_date: string | null
          notes: string | null
          purchase_cost: number
          purchase_date: string | null
          registration_number: string | null
          salvage_value: number
          serial_number: string | null
          status: string
          subcategory: string | null
          supplier_id: string | null
          updated_at: string
          useful_life_years: number
          warranty_expiry: string | null
          year_manufactured: number | null
        }
        Insert: {
          accumulated_depreciation?: number
          asset_code: string
          assigned_to?: string | null
          attributes?: Json | null
          branch_id?: string | null
          category: string
          chassis_number?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          depreciation_method?: string
          depreciation_rate?: number
          description?: string | null
          document_url?: string | null
          engine_number?: string | null
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name: string
          name_am?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          registration_number?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          useful_life_years?: number
          warranty_expiry?: string | null
          year_manufactured?: number | null
        }
        Update: {
          accumulated_depreciation?: number
          asset_code?: string
          assigned_to?: string | null
          attributes?: Json | null
          branch_id?: string | null
          category?: string
          chassis_number?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          current_value?: number
          depreciation_method?: string
          depreciation_rate?: number
          description?: string | null
          document_url?: string | null
          engine_number?: string | null
          id?: string
          image_url?: string | null
          insurance_expiry?: string | null
          location?: string | null
          manufacturer?: string | null
          model?: string | null
          name?: string
          name_am?: string | null
          next_maintenance_date?: string | null
          notes?: string | null
          purchase_cost?: number
          purchase_date?: string | null
          registration_number?: string | null
          salvage_value?: number
          serial_number?: string | null
          status?: string
          subcategory?: string | null
          supplier_id?: string | null
          updated_at?: string
          useful_life_years?: number
          warranty_expiry?: string | null
          year_manufactured?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          branch_id: string | null
          clock_in: string | null
          clock_out: string | null
          created_at: string
          date: string
          employee_id: string
          hours_worked: number
          id: string
          notes: string | null
          overtime_hours: number
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id: string
          hours_worked?: number
          id?: string
          notes?: string | null
          overtime_hours?: number
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          clock_in?: string | null
          clock_out?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          hours_worked?: number
          id?: string
          notes?: string | null
          overtime_hours?: number
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          after_data: Json | null
          before_data: Json | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          ip_address: string | null
          severity: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          after_data?: Json | null
          before_data?: Json | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          ip_address?: string | null
          severity?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          city: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          manager_user_id: string | null
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          manager_user_id?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      category_field_schemas: {
        Row: {
          category_id: string
          created_at: string
          custom_fields: Json | null
          default_reorder_point: number | null
          default_tax_rate: number | null
          default_unit: string | null
          default_warranty_months: number | null
          id: string
          required_fields: Json | null
          storage_conditions: string | null
          track_batch: boolean | null
          track_expiry: boolean | null
          track_serial: boolean | null
          track_warranty: boolean | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          custom_fields?: Json | null
          default_reorder_point?: number | null
          default_tax_rate?: number | null
          default_unit?: string | null
          default_warranty_months?: number | null
          id?: string
          required_fields?: Json | null
          storage_conditions?: string | null
          track_batch?: boolean | null
          track_expiry?: boolean | null
          track_serial?: boolean | null
          track_warranty?: boolean | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          custom_fields?: Json | null
          default_reorder_point?: number | null
          default_tax_rate?: number | null
          default_unit?: string | null
          default_warranty_months?: number | null
          id?: string
          required_fields?: Json | null
          storage_conditions?: string | null
          track_batch?: boolean | null
          track_expiry?: boolean | null
          track_serial?: boolean | null
          track_warranty?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_field_schemas_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: true
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_payments: {
        Row: {
          amount: number
          collected_by: string | null
          created_at: string
          credit_sale_id: string
          id: string
          notes: string | null
          payment_method: string
        }
        Insert: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          credit_sale_id: string
          id?: string
          notes?: string | null
          payment_method?: string
        }
        Update: {
          amount?: number
          collected_by?: string | null
          created_at?: string
          credit_sale_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_credit_sale_id_fkey"
            columns: ["credit_sale_id"]
            isOneToOne: false
            referencedRelation: "credit_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_sales: {
        Row: {
          created_at: string
          currency: string
          customer_id: string
          due_date: string
          id: string
          notes: string | null
          paid_amount: number
          sale_id: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          customer_id: string
          due_date: string
          id?: string
          notes?: string | null
          paid_amount?: number
          sale_id: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          customer_id?: string
          due_date?: string
          id?: string
          notes?: string | null
          paid_amount?: number
          sale_id?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_sales_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          alt_phone: string | null
          city: string | null
          created_at: string
          created_by: string | null
          credit_balance: number | null
          email: string | null
          gov_id: string | null
          guarantor_name: string | null
          guarantor_phone: string | null
          id: string
          id_document_back_url: string | null
          id_document_url: string | null
          kebele: string | null
          name: string
          name_am: string | null
          notes: string | null
          phone: string | null
          photo_url: string | null
          sub_city: string | null
          telegram_chat_id: string | null
          total_purchases: number | null
          trust: number
          updated_at: string
          woreda: string | null
        }
        Insert: {
          alt_phone?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number | null
          email?: string | null
          gov_id?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_url?: string | null
          kebele?: string | null
          name: string
          name_am?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          sub_city?: string | null
          telegram_chat_id?: string | null
          total_purchases?: number | null
          trust?: number
          updated_at?: string
          woreda?: string | null
        }
        Update: {
          alt_phone?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          credit_balance?: number | null
          email?: string | null
          gov_id?: string | null
          guarantor_name?: string | null
          guarantor_phone?: string | null
          id?: string
          id_document_back_url?: string | null
          id_document_url?: string | null
          kebele?: string | null
          name?: string
          name_am?: string | null
          notes?: string | null
          phone?: string | null
          photo_url?: string | null
          sub_city?: string | null
          telegram_chat_id?: string | null
          total_purchases?: number | null
          trust?: number
          updated_at?: string
          woreda?: string | null
        }
        Relationships: []
      }
      employee_loans: {
        Row: {
          approved_by: string | null
          created_at: string
          employee_id: string
          expected_end_date: string | null
          id: string
          interest_rate: number
          loan_amount: number
          monthly_deduction: number
          notes: string | null
          remaining_balance: number
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          employee_id: string
          expected_end_date?: string | null
          id?: string
          interest_rate?: number
          loan_amount?: number
          monthly_deduction?: number
          notes?: string | null
          remaining_balance?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          employee_id?: string
          expected_end_date?: string | null
          id?: string
          interest_rate?: number
          loan_amount?: number
          monthly_deduction?: number
          notes?: string | null
          remaining_balance?: number
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          bank_account: string | null
          bank_name: string | null
          base_salary: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_code: string
          employment_type: string
          full_name: string
          full_name_am: string | null
          gender: string | null
          hire_date: string
          housing_allowance: number
          id: string
          notes: string | null
          other_allowance: number
          pension_number: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          position_allowance: number
          status: string
          termination_date: string | null
          tin_number: string | null
          transport_allowance: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code: string
          employment_type?: string
          full_name: string
          full_name_am?: string | null
          gender?: string | null
          hire_date?: string
          housing_allowance?: number
          id?: string
          notes?: string | null
          other_allowance?: number
          pension_number?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          position_allowance?: number
          status?: string
          termination_date?: string | null
          tin_number?: string | null
          transport_allowance?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          bank_account?: string | null
          bank_name?: string | null
          base_salary?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_code?: string
          employment_type?: string
          full_name?: string
          full_name_am?: string | null
          gender?: string | null
          hire_date?: string
          housing_allowance?: number
          id?: string
          notes?: string | null
          other_allowance?: number
          pension_number?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          position_allowance?: number
          status?: string
          termination_date?: string | null
          tin_number?: string | null
          transport_allowance?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      exchange_rates: {
        Row: {
          base_currency: string
          fetched_at: string
          id: string
          rate: number
          source: string | null
          target_currency: string
        }
        Insert: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate: number
          source?: string | null
          target_currency?: string
        }
        Update: {
          base_currency?: string
          fetched_at?: string
          id?: string
          rate?: number
          source?: string | null
          target_currency?: string
        }
        Relationships: []
      }
      goods_receipts: {
        Row: {
          branch_id: string | null
          created_at: string
          grn_number: string
          id: string
          notes: string | null
          po_id: string | null
          received_by: string | null
          received_date: string
          status: string
          supplier_id: string | null
          total: number
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          grn_number: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          grn_number?: string
          id?: string
          notes?: string | null
          po_id?: string | null
          received_by?: string | null
          received_date?: string
          status?: string
          supplier_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "goods_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goods_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          duplicate_rows: number
          errors: Json | null
          failed_rows: number
          file_name: string | null
          file_url: string | null
          id: string
          imported_rows: number
          job_type: string
          notes: string | null
          performed_by: string | null
          quarantined_rows: number
          status: string
          total_rows: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duplicate_rows?: number
          errors?: Json | null
          failed_rows?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          imported_rows?: number
          job_type: string
          notes?: string | null
          performed_by?: string | null
          quarantined_rows?: number
          status?: string
          total_rows?: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duplicate_rows?: number
          errors?: Json | null
          failed_rows?: number
          file_name?: string | null
          file_url?: string | null
          id?: string
          imported_rows?: number
          job_type?: string
          notes?: string | null
          performed_by?: string | null
          quarantined_rows?: number
          status?: string
          total_rows?: number
        }
        Relationships: []
      }
      import_rows: {
        Row: {
          created_at: string
          errors: Json | null
          id: string
          job_id: string
          parsed_data: Json | null
          raw_data: Json
          resulting_id: string | null
          row_number: number
          status: string
          warnings: Json | null
        }
        Insert: {
          created_at?: string
          errors?: Json | null
          id?: string
          job_id: string
          parsed_data?: Json | null
          raw_data?: Json
          resulting_id?: string | null
          row_number: number
          status?: string
          warnings?: Json | null
        }
        Update: {
          created_at?: string
          errors?: Json | null
          id?: string
          job_id?: string
          parsed_data?: Json | null
          raw_data?: Json
          resulting_id?: string | null
          row_number?: number
          status?: string
          warnings?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_alerts: {
        Row: {
          alert_type: string
          asset_id: string | null
          batch_id: string | null
          branch_id: string | null
          created_at: string
          dismissed_at: string | null
          dismissed_by: string | null
          id: string
          is_dismissed: boolean
          message: string | null
          metadata: Json | null
          product_id: string | null
          recommendation: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          asset_id?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          is_dismissed?: boolean
          message?: string | null
          metadata?: Json | null
          product_id?: string | null
          recommendation?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          asset_id?: string | null
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          dismissed_at?: string | null
          dismissed_by?: string | null
          id?: string
          is_dismissed?: boolean
          message?: string | null
          metadata?: Json | null
          product_id?: string | null
          recommendation?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_alerts_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          entry_code: string
          entry_date: string
          id: string
          reference: string | null
          status: string
          total_credit: number
          total_debit: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_code: string
          entry_date?: string
          id?: string
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          entry_code?: string
          entry_date?: string
          id?: string
          reference?: string | null
          status?: string
          total_credit?: number
          total_debit?: number
        }
        Relationships: []
      }
      journal_lines: {
        Row: {
          account_id: string
          credit: number
          debit: number
          description: string | null
          id: string
          journal_id: string
        }
        Insert: {
          account_id: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id: string
        }
        Update: {
          account_id?: string
          credit?: number
          debit?: number
          description?: string | null
          id?: string
          journal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_lines_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journal_lines_journal_id_fkey"
            columns: ["journal_id"]
            isOneToOne: false
            referencedRelation: "journal_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          days_count: number
          employee_id: string
          end_date: string
          id: string
          leave_type: string
          reason: string | null
          rejection_reason: string | null
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          days_count?: number
          employee_id: string
          end_date: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          days_count?: number
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: string
          reason?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          paid_at: string | null
          payee: string
          payment_method: string | null
          reason: string | null
          request_code: string
          requester_id: string | null
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payee: string
          payment_method?: string | null
          reason?: string | null
          request_code: string
          requester_id?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payee?: string
          payment_method?: string | null
          reason?: string | null
          request_code?: string
          requester_id?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: []
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          employee_count: number
          id: string
          notes: string | null
          pay_date: string
          period_month: number
          period_year: number
          run_code: string
          status: string
          total_employee_pension: number
          total_employer_pension: number
          total_gross: number
          total_loan_deductions: number
          total_net: number
          total_other_deductions: number
          total_paye: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          notes?: string | null
          pay_date?: string
          period_month: number
          period_year: number
          run_code: string
          status?: string
          total_employee_pension?: number
          total_employer_pension?: number
          total_gross?: number
          total_loan_deductions?: number
          total_net?: number
          total_other_deductions?: number
          total_paye?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          employee_count?: number
          id?: string
          notes?: string | null
          pay_date?: string
          period_month?: number
          period_year?: number
          run_code?: string
          status?: string
          total_employee_pension?: number
          total_employer_pension?: number
          total_gross?: number
          total_loan_deductions?: number
          total_net?: number
          total_other_deductions?: number
          total_paye?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payslips: {
        Row: {
          base_salary: number
          bonus: number
          branch_id: string | null
          created_at: string
          days_worked: number
          employee_id: string
          employee_pension: number
          employer_pension: number
          gross_pay: number
          housing_allowance: number
          id: string
          loan_deduction: number
          net_pay: number
          notes: string | null
          other_allowance: number
          other_deductions: number
          overtime_amount: number
          paye_tax: number
          payment_method: string
          payroll_run_id: string
          period_month: number
          period_year: number
          position_allowance: number
          status: string
          taxable_income: number
          total_deductions: number
          transport_allowance: number
          updated_at: string
        }
        Insert: {
          base_salary?: number
          bonus?: number
          branch_id?: string | null
          created_at?: string
          days_worked?: number
          employee_id: string
          employee_pension?: number
          employer_pension?: number
          gross_pay?: number
          housing_allowance?: number
          id?: string
          loan_deduction?: number
          net_pay?: number
          notes?: string | null
          other_allowance?: number
          other_deductions?: number
          overtime_amount?: number
          paye_tax?: number
          payment_method?: string
          payroll_run_id: string
          period_month: number
          period_year: number
          position_allowance?: number
          status?: string
          taxable_income?: number
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Update: {
          base_salary?: number
          bonus?: number
          branch_id?: string | null
          created_at?: string
          days_worked?: number
          employee_id?: string
          employee_pension?: number
          employer_pension?: number
          gross_pay?: number
          housing_allowance?: number
          id?: string
          loan_deduction?: number
          net_pay?: number
          notes?: string | null
          other_allowance?: number
          other_deductions?: number
          overtime_amount?: number
          paye_tax?: number
          payment_method?: string
          payroll_run_id?: string
          period_month?: number
          period_year?: number
          position_allowance?: number
          status?: string
          taxable_income?: number
          total_deductions?: number
          transport_allowance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payslips_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payslips_payroll_run_id_fkey"
            columns: ["payroll_run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_activity_logs: {
        Row: {
          action_type: string
          amount: number | null
          created_at: string
          customer_id: string | null
          description: string
          details: Json | null
          id: string
          product_id: string | null
          sale_id: string | null
          user_id: string
        }
        Insert: {
          action_type: string
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          description?: string
          details?: Json | null
          id?: string
          product_id?: string | null
          sale_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string
          amount?: number | null
          created_at?: string
          customer_id?: string | null
          description?: string
          details?: Json | null
          id?: string
          product_id?: string | null
          sale_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      product_batches: {
        Row: {
          batch_number: string
          branch_id: string | null
          cost: number
          created_at: string
          expiry_date: string | null
          id: string
          manufactured_date: string | null
          notes: string | null
          product_id: string
          quantity: number
          received_date: string
          serial_number: string | null
          status: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          batch_number: string
          branch_id?: string | null
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufactured_date?: string | null
          notes?: string | null
          product_id: string
          quantity?: number
          received_date?: string
          serial_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          batch_number?: string
          branch_id?: string | null
          cost?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          manufactured_date?: string | null
          notes?: string | null
          product_id?: string
          quantity?: number
          received_date?: string
          serial_number?: string | null
          status?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          name_am: string | null
          parent_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          name_am?: string | null
          parent_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          name_am?: string | null
          parent_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attributes: Json | null
          barcode: string | null
          branch_id: string | null
          category: string
          category_id: string | null
          cost: number
          created_at: string
          created_by: string | null
          description: string | null
          expiry_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          max_stock: number | null
          min_stock: number
          name: string
          name_am: string | null
          price: number
          reorder_point: number
          sku: string | null
          stock: number
          storage_conditions: string | null
          subcategory: string | null
          supplier_id: string | null
          tax_rate: number
          track_batch: boolean
          track_expiry: boolean
          track_serial: boolean
          unit: string
          updated_at: string
          variants: Json | null
          warranty_months: number | null
        }
        Insert: {
          attributes?: Json | null
          barcode?: string | null
          branch_id?: string | null
          category?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_stock?: number | null
          min_stock?: number
          name: string
          name_am?: string | null
          price?: number
          reorder_point?: number
          sku?: string | null
          stock?: number
          storage_conditions?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          tax_rate?: number
          track_batch?: boolean
          track_expiry?: boolean
          track_serial?: boolean
          unit?: string
          updated_at?: string
          variants?: Json | null
          warranty_months?: number | null
        }
        Update: {
          attributes?: Json | null
          barcode?: string | null
          branch_id?: string | null
          category?: string
          category_id?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_stock?: number | null
          min_stock?: number
          name?: string
          name_am?: string | null
          price?: number
          reorder_point?: number
          sku?: string | null
          stock?: number
          storage_conditions?: string | null
          subcategory?: string | null
          supplier_id?: string | null
          tax_rate?: number
          track_batch?: boolean
          track_expiry?: boolean
          track_serial?: boolean
          unit?: string
          updated_at?: string
          variants?: Json | null
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by_admin: string | null
          father_name: string | null
          full_name: string
          grandfather_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by_admin?: string | null
          father_name?: string | null
          full_name?: string
          grandfather_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by_admin?: string | null
          father_name?: string | null
          full_name?: string
          grandfather_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          description: string
          id: string
          po_id: string
          product_id: string | null
          quantity: number
          received_qty: number
          total: number
          unit_price: number
        }
        Insert: {
          description: string
          id?: string
          po_id: string
          product_id?: string | null
          quantity?: number
          received_qty?: number
          total?: number
          unit_price?: number
        }
        Update: {
          description?: string
          id?: string
          po_id?: string
          product_id?: string | null
          quantity?: number
          received_qty?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_po_id_fkey"
            columns: ["po_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          expected_delivery: string | null
          id: string
          notes: string | null
          order_date: string
          po_number: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
          vat: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
          vat?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          po_number?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          id: string
          product_id: string | null
          product_name: string
          product_name_am: string | null
          quantity: number
          sale_id: string
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name: string
          product_name_am?: string | null
          quantity?: number
          sale_id: string
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string | null
          product_name?: string
          product_name_am?: string | null
          quantity?: number
          sale_id?: string
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cashier_id: string | null
          created_at: string
          customer_id: string | null
          id: string
          payment_method: string
          receipt_id: string
          subtotal: number
          total: number
          vat: number
        }
        Insert: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string
          receipt_id: string
          subtotal?: number
          total?: number
          vat?: number
        }
        Update: {
          cashier_id?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          payment_method?: string
          receipt_id?: string
          subtotal?: number
          total?: number
          vat?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          batch_id: string | null
          branch_id: string | null
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          performed_by: string | null
          product_id: string
          quantity_after: number
          quantity_before: number
          quantity_change: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          movement_type: string
          notes?: string | null
          performed_by?: string | null
          product_id: string
          quantity_after?: number
          quantity_before?: number
          quantity_change: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          batch_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          performed_by?: string | null
          product_id?: string
          quantity_after?: number
          quantity_before?: number
          quantity_change?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_items: {
        Row: {
          batch_id: string | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          received_quantity: number
          transfer_id: string
          unit_cost: number
        }
        Insert: {
          batch_id?: string | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          received_quantity?: number
          transfer_id: string
          unit_cost?: number
        }
        Update: {
          batch_id?: string | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          received_quantity?: number
          transfer_id?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          destination_branch_id: string
          id: string
          notes: string | null
          reason: string | null
          received_at: string | null
          rejected_reason: string | null
          requested_by: string | null
          shipped_at: string | null
          source_branch_id: string
          status: string
          total_items: number
          total_quantity: number
          transfer_code: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          destination_branch_id: string
          id?: string
          notes?: string | null
          reason?: string | null
          received_at?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          shipped_at?: string | null
          source_branch_id: string
          status?: string
          total_items?: number
          total_quantity?: number
          transfer_code: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          destination_branch_id?: string
          id?: string
          notes?: string | null
          reason?: string | null
          received_at?: string | null
          rejected_reason?: string | null
          requested_by?: string | null
          shipped_at?: string | null
          source_branch_id?: string
          status?: string
          total_items?: number
          total_quantity?: number
          transfer_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfers_destination_branch_id_fkey"
            columns: ["destination_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfers_source_branch_id_fkey"
            columns: ["source_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          category: string | null
          city: string | null
          code: string
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          license_expiry: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          phone: string | null
          rating: number
          tin_number: string | null
          total_orders: number
          total_spend: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          category?: string | null
          city?: string | null
          code: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_expiry?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number
          tin_number?: string | null
          total_orders?: number
          total_spend?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string | null
          city?: string | null
          code?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          license_expiry?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          rating?: number
          tin_number?: string | null
          total_orders?: number
          total_spend?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          access_level: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      z_reports: {
        Row: {
          bank_transfer_sales: number
          cash_in: number
          cash_out: number
          cash_sales: number
          cbe_birr_sales: number
          closed_at: string | null
          closed_by: string | null
          closing_balance: number
          created_at: string
          credit_sales_total: number
          discounts: number
          id: string
          notes: string | null
          opened_by: string | null
          opening_balance: number
          refunds: number
          report_date: string
          shift: string | null
          status: string
          telebirr_sales: number
          total_sales: number
          total_transactions: number
          total_vat: number
        }
        Insert: {
          bank_transfer_sales?: number
          cash_in?: number
          cash_out?: number
          cash_sales?: number
          cbe_birr_sales?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number
          created_at?: string
          credit_sales_total?: number
          discounts?: number
          id?: string
          notes?: string | null
          opened_by?: string | null
          opening_balance?: number
          refunds?: number
          report_date: string
          shift?: string | null
          status?: string
          telebirr_sales?: number
          total_sales?: number
          total_transactions?: number
          total_vat?: number
        }
        Update: {
          bank_transfer_sales?: number
          cash_in?: number
          cash_out?: number
          cash_sales?: number
          cbe_birr_sales?: number
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number
          created_at?: string
          credit_sales_total?: number
          discounts?: number
          id?: string
          notes?: string | null
          opened_by?: string | null
          opening_balance?: number
          refunds?: number
          report_date?: string
          shift?: string | null
          status?: string
          telebirr_sales?: number
          total_sales?: number
          total_transactions?: number
          total_vat?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_employee_id_for_user: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_branch_manager: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      is_finance_staff: { Args: { _user_id: string }; Returns: boolean }
      is_hr_staff: { Args: { _user_id: string }; Returns: boolean }
      is_procurement_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "cashier"
        | "inventory_manager"
        | "hr_admin"
        | "payroll_officer"
        | "manager"
        | "employee"
        | "finance_manager"
        | "auditor"
        | "branch_manager"
        | "procurement"
        | "user"
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
    Enums: {
      app_role: [
        "admin",
        "cashier",
        "inventory_manager",
        "hr_admin",
        "payroll_officer",
        "manager",
        "employee",
        "finance_manager",
        "auditor",
        "branch_manager",
        "procurement",
        "user",
      ],
    },
  },
} as const
