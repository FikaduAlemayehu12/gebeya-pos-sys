import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Send, MessageCircle, Phone, Loader2, CheckCircle, Settings, Copy } from 'lucide-react';

interface ReminderSettingsProps {
  onSendReminders: () => void;
}

export default function ReminderSettings({ onSendReminders }: ReminderSettingsProps) {
  const { toast } = useToast();
  const [sending, setSending] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [webhookSet, setWebhookSet] = useState(false);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/telegram-webhook`;

  const handleSendReminders = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-credit-reminders');
      if (error) throw error;
      const results = data?.results || [];
      const tgSent = results.filter((r: any) => r.telegram).length;
      const smsSent = results.filter((r: any) => r.sms).length;
      toast({
        title: '📤 Reminders Sent',
        description: `Telegram: ${tgSent}, SMS: ${smsSent} of ${results.length} customers`,
      });
      onSendReminders();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setSending(false);
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast({ title: 'Webhook URL copied!' });
  };

  const handleSetupWebhook = async () => {
    setSettingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-telegram-webhook');
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWebhookSet(true);
      toast({ title: '✅ Telegram webhook set up automatically!' });
    } catch (err: any) {
      toast({ title: 'Webhook setup failed', description: err.message, variant: 'destructive' });
    }
    setSettingWebhook(false);
  };

  return (
    <div className="space-y-4">
      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-info" />
            Telegram Bot Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>1. Create a bot via <a href="https://t.me/BotFather" target="_blank" className="text-primary underline">@BotFather</a> on Telegram</p>
            <p>2. Set the bot token as a secret (TELEGRAM_BOT_TOKEN)</p>
            <p>3. Set the webhook URL below in BotFather:</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={webhookUrl}
              readOnly
              className="text-[10px] h-8 font-mono bg-muted"
            />
            <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={copyWebhookUrl}>
              <Copy className="w-3 h-3" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs gap-1.5"
            onClick={handleSetupWebhook}
            disabled={settingWebhook || webhookSet}
          >
            {settingWebhook ? <Loader2 className="w-3 h-3 animate-spin" /> : webhookSet ? <CheckCircle className="w-3 h-3 text-success" /> : <Settings className="w-3 h-3" />}
            {webhookSet ? 'Webhook Active' : 'Auto-Setup Webhook'}
          </Button>
          <div className="text-[10px] text-muted-foreground bg-muted rounded-lg p-2 font-mono">
            Or set manually: https://api.telegram.org/bot{'<TOKEN>'}/setWebhook?url={webhookUrl}
          </div>
          <div className="text-xs bg-success/10 text-success rounded-lg p-2">
            ⏰ <strong>Auto-scheduled:</strong> Reminders run daily at 8:00 AM automatically.
          </div>
          <div className="text-xs text-muted-foreground">
            <p className="font-medium text-foreground">Customer Linking:</p>
            <p>Customers send <code className="text-primary">/start 0911234567</code> to the bot to link their account and receive reminders.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Phone className="w-4 h-4 text-success" />
            SMS Setup (Africa's Talking)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-xs text-muted-foreground space-y-1">
            <p>1. Create account at <a href="https://africastalking.com" target="_blank" className="text-primary underline">africastalking.com</a></p>
            <p>2. Set secrets: AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME</p>
            <p>3. SMS will be sent to all customers with phone numbers</p>
          </div>
          <Badge variant="outline" className="text-[10px]">Requires paid Africa's Talking account</Badge>
        </CardContent>
      </Card>

      <Button
        onClick={handleSendReminders}
        disabled={sending}
        className="w-full gradient-primary text-primary-foreground"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
        Send Reminders Now / ማሳሰቢያ ይላኩ
      </Button>
    </div>
  );
}
