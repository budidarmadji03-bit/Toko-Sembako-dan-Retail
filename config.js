/*
 * RetailPro configuration
 * Isi SUPABASE_URL dan SUPABASE_ANON_KEY untuk memakai Supabase.
 * Jika belum diisi, aplikasi otomatis berjalan dalam Mode Demo Lokal
 * menggunakan localStorage sehingga seluruh fitur frontend tetap dapat diuji.
 */

const SUPABASE_URL = "https://trfbpfjspgwkddmcjspw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_zUNHHLP4-JxYbZvPLZIKxQ_X3ndeT53";

const SUPABASE_CONFIGURED =
  SUPABASE_URL.startsWith("https://") &&
  SUPABASE_URL.includes("supabase.co") &&
  SUPABASE_ANON_KEY.length > 20;

let supabaseClient = null;

if (SUPABASE_CONFIGURED && window.supabase) {
  supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

window.RETAILPRO_CONFIG = {
  SUPABASE_CONFIGURED,
  SUPABASE_URL
};
