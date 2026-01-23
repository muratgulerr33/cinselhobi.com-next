import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-6">Kayıt Ol</h1>
      <SignupForm />
    </div>
  );
}

