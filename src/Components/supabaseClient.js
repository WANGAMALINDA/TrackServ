import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://kpayrsedzclqifkehogw.supabase.co";
const supabaseAnonKey = "sb_publishable_b8iKG1Vt4KgF9w_tDW-oog_o-1jftm2";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
