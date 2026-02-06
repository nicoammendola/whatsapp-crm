import { RegisterForm } from "@/components/auth/RegisterForm";

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-6 text-center text-2xl font-bold text-zinc-900 dark:text-zinc-100">
        WhatsApp CRM
      </h1>
      <RegisterForm />
    </>
  );
}
