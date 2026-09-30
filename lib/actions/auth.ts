"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z
  .string()
  .email({ message: "Please enter a valid email address." });

const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters." })
  .regex(/[a-zA-Z]/, { message: "Password must contain at least one letter." })
  .regex(/[0-9]/, { message: "Password must contain at least one number." })
  .regex(/[^a-zA-Z0-9]/, {
    message: "Password must contain at least one special character.",
  });

const signinSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { message: "Password is required." }),
});

const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

type FormState =
  | { errors?: { email?: string[]; password?: string[] }; message?: string }
  | undefined;

export async function login(state: FormState, formData: FormData) {
  const validated = signinSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return {
      message: "Incorrect email or password.",
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signup(state: FormState, formData: FormData) {
  const validated = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!validated.success) {
    return {
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
  });

  if (error) {
    return {
      message: error.message,
    };
  }

  return {
    message:
      "Check your email for a confirmation link. You'll be signed in shortly.",
  };
}

export async function signout() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
