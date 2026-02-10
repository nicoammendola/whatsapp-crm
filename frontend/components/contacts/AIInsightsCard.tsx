"use client";

import { useState } from "react";
import { analysisApi } from "@/lib/api";
import type { Contact } from "@/types";

interface AIInsightsCardProps {
  contact: Contact;
  onAnalysisComplete?: () => void;
}

export function AIInsightsCard({ contact, onAnalysisComplete }: AIInsightsCardProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      const response = await analysisApi.analyzeContact(contact.id);

      if (response.data.success) {
        if (onAnalysisComplete) onAnalysisComplete();
      } else {
        setError(response.data.error || "Analysis failed");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const renderStars = (value: number) => {
    return "★".repeat(value) + "☆".repeat(5 - value);
  };

  if (!contact.lastLlmAnalysis) {
    return (
      <div className="rounded-lg bg-white p-6 shadow dark:bg-zinc-800">
        <h3 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">AI Insights</h3>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          Analyze this conversation to understand communication patterns and get smart suggestions.
        </p>
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:bg-zinc-300 dark:disabled:bg-zinc-600"
        >
          {analyzing ? "🔄 Analyzing..." : "✨ Analyze Now"}
        </button>
      </div>
    );
  }

  const timeSince = new Date(contact.lastLlmAnalysis);
  const hoursAgo = Math.floor((Date.now() - timeSince.getTime()) / (1000 * 60 * 60));
  const timeText =
    hoursAgo < 1
      ? "just now"
      : hoursAgo < 24
      ? `${hoursAgo} hours ago`
      : `${Math.floor(hoursAgo / 24)} days ago`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">AI Insights</h3>
        <button
          onClick={handleAnalyze}
          disabled={analyzing}
          className="text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
        >
          {analyzing ? "Analyzing..." : "🔄 Refresh"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-xs text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="space-y-4">
        {/* Summary - at top */}
        {contact.conversationSummary && (
          <div>
            <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Summary</div>
            <p
              className={`text-sm text-zinc-900 dark:text-zinc-100 ${
                !expanded && contact.conversationSummary.length > 150 ? "line-clamp-3" : ""
              }`}
            >
              {contact.conversationSummary}
            </p>
            {contact.conversationSummary.length > 150 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
              >
                {expanded ? "Show less ▲" : "Show more ▼"}
              </button>
            )}
          </div>
        )}

        {/* Communication Style */}
        {(contact.tone || contact.warmth || contact.responseSpeed || contact.averageMessageLength) && (
          <div className={`space-y-3 ${contact.conversationSummary ? "border-t border-zinc-200 pt-4 dark:border-zinc-700" : ""}`}>
            {contact.tone && (
              <AIField label="Tone" icon="🎯" value={contact.tone} capitalize />
            )}
            {contact.warmth && (
              <AIField label="Warmth" icon="🌡️" value={renderStars(contact.warmth)} />
            )}
            {contact.responseSpeed && (
              <AIField label="Response Speed" icon="⚡" value={contact.responseSpeed} capitalize />
            )}
            {contact.averageMessageLength && (
              <AIField label="Message Length" icon="📏" value={contact.averageMessageLength} capitalize />
            )}
          </div>
        )}

        {/* Relationship Indicators */}
        {(contact.relationshipDepth || contact.conversationBalance || contact.engagementLevel) && (
          <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            {contact.relationshipDepth && (
              <AIField label="Relationship Depth" icon="💬" value={renderStars(contact.relationshipDepth)} />
            )}
            {contact.conversationBalance && (
              <div className="flex items-start gap-2">
                <span className="h-4 w-4 mt-1 flex-shrink-0 text-zinc-400 dark:text-zinc-500">⚖️</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Conversation Balance</div>
                  <div className="text-sm text-zinc-900 dark:text-zinc-100">
                    {renderStars(contact.conversationBalance)}
                    <span className="ml-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {contact.conversationBalance <= 2
                        ? "(You drive)"
                        : contact.conversationBalance >= 4
                        ? "(They drive)"
                        : "(Balanced)"}
                    </span>
                  </div>
                </div>
              </div>
            )}
            {contact.engagementLevel && (
              <AIField label="Engagement Level" icon="📊" value={contact.engagementLevel} capitalize />
            )}
          </div>
        )}

        {/* Topics & Interests */}
        {((contact.primaryTopics && contact.primaryTopics.length > 0) ||
          (contact.sharedInterests && contact.sharedInterests.length > 0)) && (
          <div className="space-y-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            {contact.primaryTopics && contact.primaryTopics.length > 0 && (
              <div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Primary Topics</div>
                <div className="flex flex-wrap gap-1">
                  {contact.primaryTopics.map((topic, i) => (
                    <span
                      key={i}
                      className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {contact.sharedInterests && contact.sharedInterests.length > 0 && (
              <div>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">Shared Interests</div>
                <div className="flex flex-wrap gap-1">
                  {contact.sharedInterests.map((interest, i) => (
                    <span
                      key={i}
                      className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    >
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Last Analyzed */}
        <div className="text-right text-xs text-zinc-500 dark:text-zinc-400">Last analyzed: {timeText}</div>
      </div>
    </div>
  );
}

function AIField({ label, icon, value, capitalize }: { label: string; icon: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="h-4 w-4 mt-1 flex-shrink-0 text-zinc-400 dark:text-zinc-500">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-zinc-600 dark:text-zinc-400 mb-1">{label}</div>
        <div className="text-sm text-zinc-900 dark:text-zinc-100">{capitalize ? value.charAt(0).toUpperCase() + value.slice(1) : value}</div>
      </div>
    </div>
  );
}
