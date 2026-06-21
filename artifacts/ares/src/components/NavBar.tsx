import { useLocation } from "wouter";
import { MessageSquare, Users, Settings } from "lucide-react";

const links = [
  { href: "/", label: "CHAT", icon: MessageSquare },
  { href: "/persons", label: "PERSONS", icon: Users },
  { href: "/settings", label: "SETTINGS", icon: Settings },
];

export default function NavBar() {
  const [location, navigate] = useLocation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur-sm flex items-center px-4 gap-1">
      <div className="flex items-center gap-2 mr-6">
        <div className="w-7 h-7 rounded-full border border-primary/60 flex items-center justify-center relative">
          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
          <div className="absolute inset-0 rounded-full pulse-ring" />
        </div>
        <span className="text-primary text-sm font-bold tracking-widest glow-text">A.R.I.A.</span>
      </div>
      <div className="flex gap-1">
        {links.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <button
              key={href}
              onClick={() => navigate(href)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded text-xs tracking-wider transition-all ${
                active
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border border-transparent"
              }`}
            >
              <Icon size={13} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
