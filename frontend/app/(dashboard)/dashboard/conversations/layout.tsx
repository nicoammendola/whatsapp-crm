export default function ConversationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="-m-4 flex h-[calc(100vh-3.5rem)] min-h-0 md:-m-6">
      {children}
    </div>
  );
}
