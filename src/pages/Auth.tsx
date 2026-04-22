import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShoppingCart, Loader2, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const { session, loading } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [settingUp, setSettingUp] = useState(false);
  const { signIn } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background pattern-ethiopian">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) return <Navigate to="/" replace />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast({ title: 'Login Failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupEmail.trim() || !setupPassword.trim()) return;
    if (setupPassword.length < 6) {
      toast({ title: 'Password too short', description: 'Minimum 6 characters', variant: 'destructive' });
      return;
    }
    setSettingUp(true);
    const { data, error } = await supabase.functions.invoke('bootstrap-admin', {
      body: { email: setupEmail, password: setupPassword },
    });
    setSettingUp(false);
    if (error || data?.error) {
      toast({ title: 'Setup Failed', description: data?.error || error?.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Admin created!', description: 'You can now sign in with your credentials.' });
      setEmail(setupEmail);
      setShowSetup(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background pattern-ethiopian p-4">
      <Card className="w-full max-w-sm bg-card">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl gradient-gold flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-xl">Gebeya POS</CardTitle>
          <p className="text-sm text-muted-foreground font-ethiopic">ወደ ገበያ ሥርዓት ይግቡ</p>
        </CardHeader>
        <CardContent>
          {showSetup ? (
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Shield className="w-4 h-4" />
                <span>First-time setup — Create admin account</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-email">Admin Email</Label>
                <Input id="setup-email" type="email" value={setupEmail} onChange={e => setSetupEmail(e.target.value)} placeholder="admin@gebeya.com" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setup-password">Password</Label>
                <Input id="setup-password" type="password" value={setupPassword} onChange={e => setSetupPassword(e.target.value)} placeholder="Min 6 characters" required />
              </div>
              <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={settingUp}>
                {settingUp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create Admin Account
              </Button>
              <Button type="button" variant="ghost" className="w-full text-xs" onClick={() => setShowSetup(false)}>
                Back to Sign In
              </Button>
            </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@gebeya.com" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>
                <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Sign In / ግባ
                </Button>
              </form>
              <Button variant="link" className="w-full text-xs mt-3 text-muted-foreground" onClick={() => setShowSetup(true)}>
                First time? Set up admin account
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
