"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-SG">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center" }}>
        <h1 style={{ color: "#1c2e6e" }}>Something went wrong</h1>
        <p style={{ color: "#5a6672" }}>The application hit an unexpected error.</p>
        <button onClick={reset} style={{ padding: "8px 16px" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
