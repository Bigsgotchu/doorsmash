import { createBrowserClient } from "@supabase/ssr";

export function createBrowserSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

  if (
    !supabaseUrl ||
    !supabaseUrl.startsWith("http") ||
    !supabaseKey
  ) {
    return createBrowserClient(
      "https://placeholder.supabase.co",
      "placeholder",
      {
        cookieOptions: {
          name: "sb-placeholder",
        },
      },
    );
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
