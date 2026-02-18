"use client";

import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResetLink(null);
    setMessage("");
    setIsLoading(true);
    try {
      const { data } = await authApi.forgotPassword({ email });
      setMessage(data.message);
      if (data.resetLink) setResetLink(data.resetLink);
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Request failed";
      setError(msg ?? "Request failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (message) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
          {resetLink && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                For testing, use this link:
              </p>
              <a
                href={resetLink}
                className="block break-all rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {resetLink}
              </a>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Link expires in 1 hour.
              </p>
            </div>
          )}
          <Link
            href="/login"
            className="inline-block text-sm font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forgot password</CardTitle>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your email and we&apos;ll send you a link to reset your password.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <Button type="submit" className="w-full" isLoading={isLoading}>
            Send reset link
          </Button>
          <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
            Remember your password?{" "}
            <Link href="/login" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
