import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Code2, Users, Zap, Terminal, ArrowRight, Loader2 } from 'lucide-react';
import { useEffect } from 'react';

export default function Index() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (user && !loading) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 gradient-glow opacity-60" />
      <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px]" />
      <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[100px]" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg gradient-primary glow-primary">
            <Code2 className="h-6 w-6 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-gradient">CodeVibe</span>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/auth?tab=login')}>
            Sign In
          </Button>
          <Button className="gradient-primary glow-sm" onClick={() => navigate('/auth?tab=signup')}>
            Get Started
          </Button>
        </div>
      </header>

      {/* Hero section */}
      <main className="relative z-10 flex flex-col items-center justify-center px-6 pt-20 pb-32 max-w-5xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-sm text-primary mb-8 animate-fade-up">
          <Zap className="h-4 w-4" />
          <span>Real-time collaborative coding</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Code together,
          <br />
          <span className="text-gradient">build faster</span>
        </h1>

        <p className="text-xl text-muted-foreground max-w-2xl mb-10 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          The collaborative IDE for teams and interviews. Write, run, and share code in real-time with anyone, anywhere.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 animate-fade-up" style={{ animationDelay: '0.3s' }}>
          <Button
            size="lg"
            className="gradient-primary glow-primary text-lg px-8 py-6"
            onClick={() => navigate('/auth?tab=signup')}
          >
            Start Coding Free
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="text-lg px-8 py-6"
            onClick={() => navigate('/auth?tab=login')}
          >
            Sign In
          </Button>
        </div>

        {/* Features preview */}
        <div className="grid md:grid-cols-3 gap-6 mt-24 w-full animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <div className="p-6 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Real-time Collaboration</h3>
            <p className="text-muted-foreground text-sm">
              See teammates' cursors and changes instantly. Perfect for pair programming and interviews.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Code2 className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Powerful Editor</h3>
            <p className="text-muted-foreground text-sm">
              Powered by Monaco (VS Code engine). Syntax highlighting, autocomplete, and more.
            </p>
          </div>

          <div className="p-6 rounded-xl bg-card/50 border border-border/50 backdrop-blur-sm hover:border-primary/30 transition-colors">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Terminal className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Instant Execution</h3>
            <p className="text-muted-foreground text-sm">
              Run JavaScript and TypeScript directly in the browser. See results immediately.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/30 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-muted-foreground text-sm">
          <p>© 2024 CodeVibe. Built with ❤️ for developers.</p>
        </div>
      </footer>
    </div>
  );
}
