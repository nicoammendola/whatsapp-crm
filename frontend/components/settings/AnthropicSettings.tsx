"use client";

import { useState, useEffect } from "react";
import { settingsApi } from "@/lib/api";

const ANTHROPIC_MODELS = [
  { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5 (Recommended)" },
  { value: "claude-opus-4-5-20251101", label: "Claude Opus 4.5 (Most Capable)" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (Fastest)" },
];

export default function AnthropicSettings() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("claude-sonnet-4-5-20250929");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await settingsApi.get();
      setModel(response.data.anthropicModel);
      setHasApiKey(response.data.hasApiKey);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    }
  };

  const showMessage = (type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleTestConnection = async () => {
    if (!hasApiKey && !apiKey) {
      showMessage("error", "Please enter an API key first");
      return;
    }

    // If testing new key, save it first
    if (apiKey && !hasApiKey) {
      await handleSave();
    }

    setTesting(true);
    try {
      const response = await settingsApi.testAnthropic();

      if (response.data.valid) {
        showMessage("success", "✓ Connection successful!");
      } else {
        showMessage("error", `✗ ${response.data.error}`);
      }
    } catch (error) {
      showMessage("error", "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await settingsApi.update({
        anthropic_api_key: apiKey || undefined,
        anthropic_model: model,
      });

      showMessage("success", "Settings saved!");
      setApiKey(""); // Clear input
      setHasApiKey(true);
    } catch (error) {
      showMessage("error", "Failed to save settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
      <h2 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-100">
        AI Analysis Configuration
      </h2>
      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">
        Configure Anthropic Claude to analyze your conversations and suggest follow-ups.
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {/* API Key Input */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Anthropic API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasApiKey ? "••••••••••••••••••••" : "sk-ant-..."}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
              >
                {showApiKey ? "👁️" : "👁️‍🗨️"}
              </button>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={testing || (!hasApiKey && !apiKey)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600"
            >
              {testing ? "Testing..." : "Test"}
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Get your API key from{" "}
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              console.anthropic.com
            </a>
          </p>
        </div>

        {/* Model Selection */}
        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Model
          </label>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-100"
          >
            {ANTHROPIC_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Sonnet 4.5 offers the best balance of speed and quality
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600"
        >
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
