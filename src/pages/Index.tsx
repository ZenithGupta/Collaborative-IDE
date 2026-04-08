import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Code2, Users, Zap, Terminal, ArrowRight, Loader2, PlayCircle, Lock, Globe } from 'lucide-react';
import { HeroBackground } from '@/components/HeroBackground';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

// Animation & Scroll
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';

gsap.registerPlugin(ScrollTrigger);

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  // Initialize Lenis & GSAP
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 1,
    });

    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // Initial Hero Animation
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '.hero-content > *',
        { y: 30, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, stagger: 0.15, ease: 'power3.out', delay: 0.2 }
      );

      // Scroll animations for value props
      gsap.utils.toArray('.value-prop').forEach((el: any) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 50 },
          {
            opacity: 1,
            y: 0,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 85%',
              toggleActions: 'play none none reverse',
            },
          }
        );
      });
    }, containerRef);

    return () => {
      lenis.destroy();
      ctx.revert();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-primary">
      {/* 3D Background */}
      <div className="fixed inset-0 z-0">
         {/* @ts-ignore */}
        <HeroBackground />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-background/50 backdrop-blur-md">
        <div className="flex flex-1 items-center gap-3">
          <div className="p-2 rounded-xl gradient-primary glow-sm ring-1 ring-white/10">
            <Code2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-white">CodeVibe</span>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="ghost" className="text-muted-foreground hover:text-white transition-colors" onClick={() => navigate('/auth?tab=login')}>
            Sign In
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary transition-all duration-300 rounded-lg px-6" onClick={() => navigate('/auth?tab=signup')}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10">
        
        {/* Immersive Hero Section */}
        <section className="relative flex flex-col items-center justify-center min-h-[90vh] px-6 text-center pt-20">
          <div className="hero-content max-w-4xl mx-auto flex flex-col items-center">
            
            <Badge variant="outline" className="mb-8 px-4 py-1.5 border-primary/30 bg-primary/10 text-primary uppercase tracking-wider text-xs font-semibold backdrop-blur-md animate-pulse-glow">
              <Zap className="w-3 h-3 mr-2 inline-block" />
              Zero-Latency Engine
            </Badge>

            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 text-white leading-[1.1]">
              Code perfectly in sync. <br />
              <span className="text-primary inline-block mt-2">Anywhere. Anytime.</span>
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mb-12 leading-relaxed">
              Experience the friction-less workflow of VS Code directly in your browser. Real-time collaboration, zero local setup, and instant execution across multiple robust environments.
            </p>

            <div className="flex flex-col sm:flex-row gap-5 items-center justify-center w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base h-14 px-8 bg-white text-black hover:bg-gray-200 transition-all font-semibold rounded-xl"
                onClick={() => navigate('/auth?tab=signup')}
              >
                Start Coding Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto text-base h-14 px-8 border-white/10 hover:bg-white/5 backdrop-blur-sm transition-all rounded-xl"
                onClick={() => navigate('/auth?tab=login')}
              >
                <PlayCircle className="mr-2 h-5 w-5" />
                View Demo
              </Button>
            </div>
          </div>
        </section>

        {/* Value Propositions */}
        <section className="py-32 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-20 value-prop">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight text-white mb-6">Designed for speed & fluidity</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Every detail engineered to remove friction between your thoughts and the final execution.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="value-prop bg-card/40 border-white/5 backdrop-blur-xl hover:border-primary/50 transition-all duration-500 overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl text-white">Real-Time Collaboration</CardTitle>
                <CardDescription className="text-base mt-2">
                  Multiplayer coding with sub-millisecond presence sync. See cursors, selections, and edits instantly across the globe.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="value-prop bg-card/40 border-white/5 backdrop-blur-xl hover:border-primary/50 transition-all duration-500 overflow-hidden group" style={{ transitionDelay: "100ms" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Terminal className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl text-white">Multi-Language Execution</CardTitle>
                <CardDescription className="text-base mt-2">
                  Compile and run Python, Java, C++, and JavaScript directly in the browser via edge-deployed containers.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="value-prop bg-card/40 border-white/5 backdrop-blur-xl hover:border-primary/50 transition-all duration-500 overflow-hidden group" style={{ transitionDelay: "200ms" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-6 ring-1 ring-primary/20 group-hover:scale-110 transition-transform duration-500">
                  <Code2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl text-white">Frictionless UI</CardTitle>
                <CardDescription className="text-base mt-2">
                  Monaco-powered editor with VS Code parity. Resizable panels, integrated terminal, and beautiful distinct themes.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Global Infra Section */}
        <section className="py-32 px-6 border-y border-white/5 bg-black/40 relative overflow-hidden backdrop-blur-sm">
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none" />
           <div className="max-w-4xl mx-auto text-center value-prop">
              <Globe className="w-16 h-16 mx-auto text-primary/80 mb-8" />
              <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Powered by Global Edge Infrastructure</h2>
              <p className="text-lg text-muted-foreground mb-10">
                 Bypass the latency of traditional servers. Our Edge functions and WebSocket network ensures your keystrokes reach your collaborators in less time than a blink.
              </p>
              <div className="flex gap-4 justify-center text-sm font-medium text-white/70">
                 <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-emerald-400" /> End-to-End Secure</span>
                 <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Edge Execution</span>
              </div>
           </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 py-12 bg-background border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-muted-foreground text-sm">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Code2 className="h-5 w-5 text-primary" />
            <span className="font-semibold text-white">CodeVibe</span>
          </div>
          <p>© 2026 CodeVibe Platform. Built for the elite.</p>
        </div>
      </footer>
    </div>
  );
}
