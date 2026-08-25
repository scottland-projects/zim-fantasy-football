"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { motion } from "framer-motion";
import { Trophy, Zap, Users, ChevronRight, Shield, Target } from "lucide-react";

const features = [
  { icon: Target, title: "Score Predictions", desc: "Predict match scores across football, cricket & rugby — no squad required" },
  { icon: Trophy, title: "Fantasy Leagues", desc: "Build your perfect football squad and compete with fans across Zimbabwe" },
  { icon: Users, title: "Fan Community", desc: "Vote in fan polls, chat with fellow fans, or start your own group's poll" },
  { icon: Zap, title: "Gamification", desc: "Earn XP, unlock badges, and climb the levels from Rookie to Legend" },
];

export default function HomeClient() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 pitch-bg opacity-20" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[min(800px,100vw)] h-[min(800px,100vw)] bg-zff-green/4 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-4 sm:px-8 lg:px-10 py-6 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <Logo size={44} />
          <div>
            <p className="font-display text-xl text-zff-black tracking-wider">AFRICA</p>
            <p className="text-[10px] text-zff-green font-medium tracking-widest">FANTASY</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-zff-black transition-colors">
            Sign In
          </Link>
          <Link href="/register" className="btn-primary text-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 pt-2 sm:pt-3 lg:pt-4 pb-16 sm:pb-24 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Logo size={340} className="mx-auto mb-1" />

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zff-green/10 border border-zff-green/20 text-zff-green text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            Made for African Sports Fans
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-display tracking-wider text-zff-black mb-4">
            AFRICA <span className="text-gradient-green">FANTASY</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
            Predict match results or build a fantasy squad across football, cricket, and rugby.
            Compete with fans nationwide. Real clubs, real points, pure passion.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/register" className="btn-primary flex items-center gap-2 text-base px-8 py-3">
              Start Playing Free <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="btn-outline flex items-center gap-2 text-base">
              Sign In
            </Link>
          </div>
        </motion.div>

        {/* Stats bar */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-24 grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-3xl mx-auto"
        >
          {[
            { value: "2,400+", label: "Active Members" },
            { value: "3", label: "Sports Covered" },
            { value: "Free", label: "To Play" },
            { value: "Zimbabwe", label: "#1 Fan Platform" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-6 text-center">
              <p className="text-2xl font-display text-zff-green tracking-wider">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 py-16 sm:py-20 lg:py-24">
        <h2 className="text-4xl font-display text-center text-zff-black tracking-wider mb-12">
          THE FULL EXPERIENCE
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-7"
            >
              <div className="w-12 h-12 rounded-xl bg-zff-green/10 border border-zff-green/20 flex items-center justify-center mb-4">
                <f.icon className="w-6 h-6 text-zff-green" />
              </div>
              <h3 className="font-bold text-zff-black mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-200 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          &copy; 2026 Africa Fantasy
          {" · "}
          <a href="/terms" className="hover:text-zff-green transition-colors">Terms of Service</a>
          {" · "}
          <a href="/privacy" className="hover:text-zff-green transition-colors">Privacy Policy</a>
        </p>
        <p className="text-xs text-muted-foreground mt-2 max-w-xl mx-auto px-4">
          Africa Fantasy is an independent fan platform and is not affiliated with, endorsed by, or officially
          connected to ZIFA, the Premier Soccer League, Zimbabwe Cricket, Zimbabwe Rugby Union, or any
          participating club.
        </p>
      </footer>
    </div>
  );
}
