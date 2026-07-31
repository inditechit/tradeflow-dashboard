import { Link } from "react-router-dom";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const BRAND = "Copy Trade Engine";

export function PublicMarketingChrome({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-bold text-slate-900">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD700] text-black shadow-sm">
              <Zap className="h-5 w-5" />
            </span>
            <span className="text-lg tracking-tight">{BRAND}</span>
          </Link>
          <nav className="hidden items-center gap-5 text-sm font-medium text-slate-600 md:flex">
            <Link to="/#why" className="hover:text-slate-900">
              Why us
            </Link>
            <Link to="/#features" className="hover:text-slate-900">
              Features
            </Link>
            <Link to="/#plans" className="hover:text-slate-900">
              Plans
            </Link>
            <Link to="/about" className="hover:text-slate-900">
              About
            </Link>
            <Link to="/blogs" className="hover:text-slate-900">
              Blogs
            </Link>
            <a href="/#contact" className="hover:text-slate-900">
              Contact
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild className="text-slate-700">
              <Link to="/login">Log in</Link>
            </Button>
            <Button asChild className="bg-[#FFD700] text-black hover:bg-[#E6C200]">
              <Link to="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200 bg-slate-50 px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm font-semibold text-slate-800">{BRAND}</p>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600">
            <Link to="/about" className="hover:text-slate-900">
              About
            </Link>
            <Link to="/blogs" className="hover:text-slate-900">
              Blogs
            </Link>
            <Link to="/login" className="hover:text-slate-900">
              Log in
            </Link>
            <Link to="/signup" className="hover:text-slate-900">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
