"use client";

import { use, useState, useEffect } from "react";
import { ConversationDetail } from "@/components/conversations/ConversationDetail";
import { ContactDetailsSidebar } from "@/components/contacts/ContactDetailsSidebar";

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = use(params);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(false);

  // Load sidebar visibility preference from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("sidebar-visible");
    if (stored !== null) {
      setSidebarVisible(stored === "true");
    }
  }, []);

  // Save preference to localStorage
  const toggleSidebar = () => {
    const newValue = !sidebarVisible;
    setSidebarVisible(newValue);
    localStorage.setItem("sidebar-visible", String(newValue));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + I: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "i") {
        e.preventDefault();
        toggleSidebar();
      }
      // Escape: Close mobile sidebar
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sidebarOpen, sidebarVisible]);
  
  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-zinc-900">
      {/* Center: Message Thread */}
      <div className="flex-1 flex flex-col min-w-0">
        <ConversationDetail 
          contactId={contactId} 
          onToggleSidebar={() => setSidebarOpen(true)}
          onToggleSidebarDesktop={toggleSidebar}
          sidebarVisible={sidebarVisible}
        />
      </div>
      
      {/* Right: Contact Details Sidebar - Desktop */}
      {sidebarVisible && (
        <div className="w-96 border-l border-zinc-200 flex-shrink-0 overflow-y-auto dark:border-zinc-700 hidden lg:block">
          <ContactDetailsSidebar contactId={contactId} />
        </div>
      )}

      {/* Mobile/Tablet Sidebar Modal */}
      {sidebarOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          
          {/* Drawer */}
          <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-zinc-900 shadow-xl z-50 overflow-y-auto lg:hidden animate-slide-in">
            <div className="sticky top-0 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700 px-4 py-3 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Contact Details</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ContactDetailsSidebar contactId={contactId} />
          </div>
        </>
      )}
    </div>
  );
}
