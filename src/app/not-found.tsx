export default function NotFound() {
  if (typeof window !== "undefined") {
    console.error("[not-found] window.location.href =", window.location.href);
  }
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">404</h1>
        <p className="text-gray-600">Page not found</p>
      </div>
    </main>
  );
}
