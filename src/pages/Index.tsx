import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';
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
    }, containerRef);

    return () => {
      lenis.destroy();
      ctx.revert();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neon-surface">
        <Loader2 className="h-8 w-8 animate-spin text-neon-primary" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-neon-surface text-neon-on-surface font-body selection:bg-neon-primary/30 min-h-screen">
      {/* TopAppBar */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 h-14 bg-[#060e20] shadow-[0_4px_20px_rgba(186,158,255,0.06)]">
        <div className="flex items-center gap-8">
          <span className="text-xl font-black tracking-tighter text-[#dee5ff] font-headline">Collaborative IDE</span>
          <nav className="hidden md:flex gap-6">
            <a className="font-['Space_Grotesk'] uppercase tracking-widest text-[10px] text-[#ba9eff] border-b-2 border-[#ba9eff] pb-1" href="#">Live</a>
            <a className="font-['Space_Grotesk'] uppercase tracking-widest text-[10px] text-[#848bab] hover:text-[#dee5ff] transition-colors" href="#">Collaborate</a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex -space-x-2">
            <img alt="Active Collaborator Avatars" className="w-6 h-6 rounded-full border-2 border-neon-outline" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCJ9q6E2MyfD7FiiHXQs4fN_9FhqwZyO7l4E1dFR4ENiyJUJN2WmxfKSRcF9IEmiiP_rP4dEQycvLOji4fhsYBqFnYR7TAWEyRHyIft5v0PFXUrRusZbuJAUyNK7maBLawfj3beyDwLt6bqvNUIOefGdZhv7FckraHbhJlGvTxomdA8Kaap-7hasMoqRyWSo3cVqKBq8z9hLcX1IRU_12nlKWt_20PdkRc4ShVFbazJFB_T7C0Ee9v-SWgA_UEGaALnZrm9mFheMMY"/>
            <img alt="Active Collaborator Avatars" className="w-6 h-6 rounded-full border-2 border-neon-outline" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAh0IUs1_gyJ8nEr2VEWorOA-kAshQ3_-45rF8jKdgALac884SSMdAOTsp4pz_JkTJDQuVGoxjP-zQ1gUR-bhADRzRWzP4UWWMsPjeFgStXoI8PdMDwV-YwdW9B8THJLd898XKZFcbP0-jM6Ls5v8t9WQM4gtvocmGTMwTqqcRkcMG5AIjftG4lldYQYlgoWYYP1uOsNZA7x8xF49oA1jNFQfm7-f4ALfHo_-g6zbSNaM67V91JfJfrLIj9sIMZJ5UpwSKR9LsoU6Y"/>
            <div className="w-6 h-6 rounded-full bg-neon-secondary flex items-center justify-center text-[10px] font-bold text-neon-on-secondary ring-2 ring-neon-secondary animate-pulse">+3</div>
          </div>
          <button className="material-symbols-outlined text-[#848bab] hover:text-[#dee5ff] transition-all p-1 hover:bg-[#192540]/50 rounded">settings</button>
        </div>
      </header>

      <main className="pt-14 pb-12">
        {/* Hero Section */}
        <section className="relative min-h-[921px] flex flex-col items-center justify-center px-6 overflow-hidden">
          {/* Background Glows */}
          <div className="absolute top-1/4 -left-20 w-96 h-96 bg-neon-primary/10 blur-[120px] rounded-full"></div>
          <div className="absolute bottom-1/4 -right-20 w-[500px] h-[500px] bg-neon-secondary/10 blur-[150px] rounded-full"></div>
          <div className="hero-content max-w-5xl w-full text-center z-10 space-y-8">
            <div className=" mt-10 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-surface-container-high border border-neon-outline-variant/20 mb-4">
              <span className="material-symbols-outlined text-neon-primary text-sm">auto_awesome</span>
              <span className="font-label text-[10px] uppercase tracking-[0.2em] text-neon-on-surface-variant">The Future of Vibe Coding is here</span>
            </div>
            <h1 className="font-headline text-5xl md:text-7xl font-extrabold tracking-tight text-neon-on-surface leading-[1.1]">
              Code at the speed of <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-primary via-neon-secondary to-neon-tertiary">pure thought.</span>
            </h1>
            <p className="font-body text-neon-on-surface-variant text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              The collaborative IDE where AI doesn't just suggest lines—it captures your vibe. Real-time synchronization for the modern engineering dream team.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button onClick={() => navigate('/auth?tab=signup')} className="px-8 py-4 bg-neon-primary text-neon-on-primary font-bold rounded-full hover:shadow-[0_0_30px_rgba(186,158,255,0.4)] transition-all active:scale-95 text-sm uppercase tracking-wider">
                Start Coding for Free
              </button>
              <button onClick={() => navigate('/auth?tab=login')} className="px-8 py-4 border border-neon-outline-variant/30 text-neon-on-surface font-bold rounded-full hover:bg-neon-surface-container-high transition-all active:scale-95 text-sm uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined">play_circle</span>
                Log In
              </button>
            </div>
          </div>
          {/* IDE Mockup */}
          <div className="hero-content mt-20 w-full max-w-6xl mx-auto relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-neon-primary/20 via-neon-secondary/20 to-neon-tertiary/20 rounded-xl blur opacity-30 group-hover:opacity-100 transition duration-1000"></div>
            <div className="relative bg-neon-surface-container-lowest border border-neon-outline-variant/10 rounded-xl overflow-hidden shadow-2xl aspect-video md:aspect-[21/9]">
              {/* Editor UI Header */}
              <div className="h-10 bg-neon-surface-container-high flex items-center px-4 gap-4 border-b border-neon-outline-variant/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neon-error/20"></div>
                  <div className="w-3 h-3 rounded-full bg-neon-tertiary/20"></div>
                  <div className="w-3 h-3 rounded-full bg-neon-secondary/20"></div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-neon-surface rounded text-[10px] font-label text-neon-on-surface-variant">
                  <span className="material-symbols-outlined text-[14px]">description</span>
                  index.ts
                </div>
              </div>
              {/* Editor Content */}
              <div className="flex h-full">
                <div className="w-12 border-r border-neon-outline-variant/5 flex flex-col items-center py-4 gap-6 text-neon-on-surface-variant/40">
                  <span className="material-symbols-outlined">folder_open</span>
                  <span className="material-symbols-outlined text-neon-primary">auto_awesome</span>
                  <span className="material-symbols-outlined">terminal</span>
                </div>
                <div className="flex-1 p-8 font-mono text-sm space-y-2 opacity-80">
                  <p><span className="text-neon-tertiary">import</span> {'{'} vibe {'}'} <span className="text-neon-tertiary">from</span> <span className="text-neon-secondary">'@neon-obs/core'</span>;</p>
                  <p>&nbsp;</p>
                  <p><span className="text-neon-primary-container">async function</span> <span className="text-neon-secondary-dim">initializeProject</span>() {'{'}</p>
                  <p className="pl-4"> <span className="text-neon-on-surface-variant">// AI is currently predicting your next architectural move...</span></p>
                  <p className="pl-4"> <span className="text-neon-tertiary">const</span> state = <span className="text-neon-primary">await</span> vibe.sync({'{'}</p>
                  <p className="pl-8 text-neon-primary/60 italic underline decoration-dotted">mode: 'collaborative_flow',</p>
                  <p className="pl-8">priority: <span className="text-neon-tertiary-dim">'high-speed'</span></p>
                  <p className="pl-4">  {'}'});</p>
                  <p>{'}'}</p>

                  {/* Floating AI Suggestion */}
                  <div className="absolute right-12 top-1/2 -translate-y-1/2 w-72 glass-panel border border-neon-primary/20 p-4 rounded-xl shadow-2xl transform rotate-1 bg-[rgba(25,37,64,0.6)] backdrop-blur-md">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-neon-primary" style={{fontVariationSettings: "'FILL' 1"}}>auto_awesome</span>
                      <span className="font-label text-[10px] text-neon-primary">Vibe Intelligence</span>
                    </div>
                    <p className="text-xs text-neon-on-surface leading-relaxed">It looks like you're building a real-time analytics hub. Should I scaffold the WebSocket provider for you?</p>
                    <div className="mt-4 flex gap-2">
                      <button className="flex-1 py-1.5 bg-neon-primary/20 hover:bg-neon-primary/40 text-neon-primary text-[10px] font-bold rounded uppercase transition-colors">Accept</button>
                      <button className="flex-1 py-1.5 text-neon-on-surface-variant text-[10px] font-bold rounded uppercase">Ignore</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Bento Grid */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <h2 className="font-headline text-3xl md:text-5xl font-bold">Engineered for the elite.</h2>
            <p className="font-body text-neon-on-surface-variant max-w-xl mx-auto">Standard IDEs are tools. Neon Observatory is an extension of your creative consciousness.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 h-auto md:h-[600px]">
            {/* AI Feature (Large) */}
            <div className="md:col-span-8 bg-neon-surface-container-low rounded-xl p-8 flex flex-col justify-between relative overflow-hidden group">
              <div className="z-10">
                <div className="w-12 h-12 rounded-lg bg-neon-primary/10 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-neon-primary text-3xl">auto_awesome</span>
                </div>
                <h3 className="font-headline text-2xl font-bold mb-4">The "Vibe Coding" Assistant</h3>
                <p className="text-neon-on-surface-variant max-w-md">Our AI doesn't just complete lines. It understands your project's architectural intent and suggests entire modules based on your current coding vibe.</p>
              </div>
              <div className="absolute right-0 bottom-0 w-2/3 h-1/2 bg-gradient-to-tl from-neon-primary/5 to-transparent rounded-tl-3xl border-t border-l border-neon-primary/10 group-hover:border-neon-primary/30 transition-all">
                <div className="p-6 space-y-3 opacity-40 group-hover:opacity-100 transition-opacity">
                  <div className="h-2 w-3/4 bg-neon-primary/20 rounded"></div>
                  <div className="h-2 w-1/2 bg-neon-primary/10 rounded"></div>
                  <div className="h-2 w-2/3 bg-neon-primary/20 rounded"></div>
                </div>
              </div>
            </div>
            {/* Collaboration (Small) */}
            <div className="md:col-span-4 bg-neon-surface-container-high rounded-xl p-8 flex flex-col justify-between border border-neon-outline-variant/5">
              <div>
                <div className="w-12 h-12 rounded-lg bg-neon-secondary/10 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-neon-secondary text-3xl">account_tree</span>
                </div>
                <h3 className="font-headline text-xl font-bold mb-4">Canva for Code</h3>
                <p className="text-neon-on-surface-variant text-sm">Real-time multiplayer editing with zero-latency synchronization. See every cursor, every change, every pulse instantly.</p>
              </div>
              <div className="mt-8 flex -space-x-3">
                <div className="w-10 h-10 rounded-full bg-neon-surface-bright border-2 border-neon-surface ring-2 ring-neon-secondary"></div>
                <div className="w-10 h-10 rounded-full bg-neon-surface-bright border-2 border-neon-surface ring-2 ring-neon-primary"></div>
                <div className="w-10 h-10 rounded-full bg-neon-surface-bright border-2 border-neon-surface ring-2 ring-neon-tertiary"></div>
              </div>
            </div>
            {/* Management (Small) */}
            <div className="md:col-span-4 bg-neon-surface-container-high rounded-xl p-8 flex flex-col border border-neon-outline-variant/5">
              <div className="w-12 h-12 rounded-lg bg-neon-tertiary/10 flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-neon-tertiary text-3xl">terminal</span>
              </div>
              <h3 className="font-headline text-xl font-bold mb-4">Terminal Overdrive</h3>
              <p className="text-neon-on-surface-variant text-sm">GPU-accelerated terminal with built-in visualization for logs and network traffic. Development has never been this beautiful.</p>
            </div>
            {/* Future-Proof (Large) */}
            <div className="md:col-span-8 bg-[#000000] rounded-xl p-8 flex items-center justify-between border border-neon-outline-variant/10 relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="font-headline text-2xl font-bold mb-2">Cloud-Native Core</h3>
                <p className="text-neon-on-surface-variant max-w-xs">Spin up an entire dev environment in 1.4 seconds. No more "it works on my machine" excuses.</p>
                <button className="mt-6 text-neon-primary font-label text-xs uppercase tracking-widest flex items-center gap-2">
                  Explore Infrastructure <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
              <div className="absolute right-0 top-0 w-1/2 h-full hidden lg:block opacity-20">
                <img alt="Global Network" className="w-full h-full object-cover rounded-xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDr40moQb12UClb9aJ1Y_raEsN9eedo76u4hNSZZsOVpL9Df8XyqKAwN1sbEzHjiY1Vytuyyakvkd9-pBZtn_oFL8mblyGyBxXedaJtIfTD2g5ooL9A2Mju8HIBcyB3JL0QXt_E4TX89IMWppaQVOw42urYsTwiC3KnxJlTlE1uzzEcM33dzTBD2FxTRb5k4gGkDsKUtk45hkZOTyvYy300agkqk6omOQuaKpv6oiuJmMbWH7UqHo1jDvTja2TUIncUH9qpuS_zPJc"/>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto glass-panel bg-[rgba(25,37,64,0.6)] backdrop-blur-md border border-neon-primary/10 rounded-2xl p-12 text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-neon-primary to-transparent"></div>
            <h2 className="font-headline text-4xl font-bold mb-6">Ready to enter the observatory?</h2>
            <p className="font-body text-neon-on-surface-variant mb-10 text-lg">Join 15,000+ developers who have already switched to a more soulful way of coding.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => navigate('/auth?tab=signup')} className="px-10 py-4 bg-neon-on-surface text-neon-surface font-black rounded-md hover:bg-neon-primary transition-colors uppercase tracking-widest text-sm">
                Create Your Workspace
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* BottomNavBar */}
     
    </div>
  );
}
