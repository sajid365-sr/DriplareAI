import PublicNav from "@/components/layout/PublicNav";
import Footer from "@/components/layout/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen relative">
      <PublicNav />
      <main className="flex-1 relative z-10">
        {children}
      </main>
      <Footer />
    </div>
  );
}
