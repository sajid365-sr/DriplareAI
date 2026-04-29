"use client";

export default function Footer() {
  return (
    <footer className="border-t border-border mt-24 py-10 text-center text-sm text-muted-foreground">
      <div className="max-w-7xl mx-auto px-6">
        © {new Date().getFullYear()} REMOVED. All rights reserved.
      </div>
    </footer>
  );
}
