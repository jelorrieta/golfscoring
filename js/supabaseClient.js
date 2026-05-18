import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
export const supabase = createClient(
  'https://mfhixtqytuawzflicylc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maGl4dHF5dHVhd3pmbGljeWxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MDAyOTEsImV4cCI6MjA4OTk3NjI5MX0.WcqKi5pputomGnP0aI3Ofr1lk-4X0XHNF1Usdnq3H-o'
);
