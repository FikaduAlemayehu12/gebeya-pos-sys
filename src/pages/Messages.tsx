import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Send, Hash, Users, Paperclip, Smile, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

type Conversation = {
  id: string; kind: string; title: string | null; last_message_at: string | null; description: string | null;
};
type Message = {
  id: string; conversation_id: string; sender_id: string; body: string | null;
  attachments: any[]; created_at: string; reply_to_id: string | null;
};
type Profile = { user_id: string; full_name: string | null; avatar_url?: string | null };

const EMOJIS = ['👍','❤️','😂','🎉','🔥','👏','🙏','✅'];

export default function Messages() {
  const { user } = useAuth();
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [reactions, setReactions] = useState<Record<string, { emoji: string; user_id: string }[]>>({});
  const [body, setBody] = useState('');
  const [search, setSearch] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newKind, setNewKind] = useState<'direct' | 'group' | 'channel'>('channel');
  const [newTitle, setNewTitle] = useState('');
  const [members, setMembers] = useState<string[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadConversations(); loadProfiles(); }, []);
  useEffect(() => { if (activeId) loadMessages(activeId); }, [activeId]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel('messages-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const m = payload.new as Message;
        if (m.conversation_id === activeId) setMessages((prev) => [...prev, m]);
        loadConversations();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, () => {
        if (activeId) loadReactions(activeId);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, activeId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages]);

  async function loadConversations() {
    const { data: mem } = await supabase.from('conversation_members').select('conversation_id').eq('user_id', user!.id);
    const ids = (mem || []).map((m: any) => m.conversation_id);
    if (!ids.length) { setConvs([]); return; }
    const { data } = await supabase.from('conversations').select('*').in('id', ids).order('last_message_at', { ascending: false });
    setConvs((data || []) as Conversation[]);
    if (!activeId && data?.length) setActiveId(data[0].id);
  }

  async function loadProfiles() {
    const { data } = await supabase.from('profiles').select('user_id, full_name, avatar_url');
    const arr = (data || []) as Profile[];
    setAllProfiles(arr);
    setProfiles(Object.fromEntries(arr.map((p) => [p.user_id, p])));
  }

  async function loadMessages(cid: string) {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', cid).order('created_at').limit(200);
    setMessages((data || []) as Message[]);
    loadReactions(cid);
    await supabase.from('conversation_members').update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', cid).eq('user_id', user!.id);
  }

  async function loadReactions(cid: string) {
    const { data: msgs } = await supabase.from('messages').select('id').eq('conversation_id', cid);
    const ids = (msgs || []).map((m: any) => m.id);
    if (!ids.length) return;
    const { data } = await supabase.from('message_reactions').select('*').in('message_id', ids);
    const grouped: Record<string, any[]> = {};
    (data || []).forEach((r: any) => { (grouped[r.message_id] ||= []).push(r); });
    setReactions(grouped);
  }

  async function send() {
    if (!activeId || (!body.trim() && !file)) return;
    let attachments: any[] = [];
    if (file) {
      const path = `${user!.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('message-attachments').upload(path, file);
      if (error) { toast.error(error.message); return; }
      attachments = [{ path, name: file.name, size: file.size, type: file.type }];
    }
    const { error } = await supabase.from('messages').insert({
      conversation_id: activeId, sender_id: user!.id, body: body.trim() || null, attachments,
    });
    if (error) { toast.error(error.message); return; }
    setBody(''); setFile(null);
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = (reactions[messageId] || []).find((r) => r.user_id === user!.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', user!.id).eq('emoji', emoji);
    } else {
      await supabase.from('message_reactions').insert({ message_id: messageId, user_id: user!.id, emoji });
    }
  }

  async function createConversation() {
    if (!newTitle.trim() && newKind !== 'direct') { toast.error('Title required'); return; }
    const { data, error } = await supabase.from('conversations').insert({
      kind: newKind, title: newTitle.trim() || null, created_by: user!.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    const roster = Array.from(new Set([user!.id, ...members]));
    await supabase.from('conversation_members').insert(
      roster.map((uid) => ({ conversation_id: data.id, user_id: uid, role: uid === user!.id ? 'admin' : 'member' }))
    );
    setNewOpen(false); setNewTitle(''); setMembers([]);
    await loadConversations();
    setActiveId(data.id);
    toast.success('Conversation created');
  }

  async function attachmentUrl(path: string) {
    const { data } = await supabase.storage.from('message-attachments').createSignedUrl(path, 3600);
    return data?.signedUrl;
  }

  const active = convs.find((c) => c.id === activeId);
  const filtered = convs.filter((c) => (c.title || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-4">
      {/* Sidebar */}
      <div className="w-72 bg-card border rounded-xl flex flex-col overflow-hidden">
        <div className="p-3 border-b flex items-center gap-2">
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button size="icon" variant="secondary"><Plus className="w-4 h-4" /></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New conversation</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['channel','group','direct'] as const).map((k) => (
                    <Button key={k} size="sm" variant={newKind === k ? 'default' : 'outline'} onClick={() => setNewKind(k)}>
                      {k}
                    </Button>
                  ))}
                </div>
                {newKind !== 'direct' && (
                  <Input placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                )}
                <div className="border rounded-md p-2 max-h-52 overflow-y-auto space-y-1">
                  {allProfiles.filter((p) => p.user_id !== user!.id).map((p) => (
                    <label key={p.user_id} className="flex items-center gap-2 text-sm py-1 cursor-pointer">
                      <input type="checkbox" checked={members.includes(p.user_id)} onChange={(e) => {
                        setMembers((prev) => e.target.checked ? [...prev, p.user_id] : prev.filter((x) => x !== p.user_id));
                      }} />
                      {p.full_name || p.user_id.slice(0, 8)}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createConversation}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
        <ScrollArea className="flex-1">
          {filtered.map((c) => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`w-full text-left px-3 py-2.5 border-b flex items-start gap-2 hover:bg-muted/50 ${activeId === c.id ? 'bg-muted' : ''}`}>
              <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {c.kind === 'channel' ? <Hash className="w-4 h-4" /> : c.kind === 'group' ? <Users className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{c.title || 'Direct'}</div>
                <div className="text-[11px] text-muted-foreground">
                  {c.last_message_at ? formatDistanceToNow(new Date(c.last_message_at), { addSuffix: true }) : 'No messages'}
                </div>
              </div>
            </button>
          ))}
          {!filtered.length && (
            <div className="p-6 text-center text-sm text-muted-foreground">No conversations. Create one.</div>
          )}
        </ScrollArea>
      </div>

      {/* Thread */}
      <div className="flex-1 bg-card border rounded-xl flex flex-col overflow-hidden">
        {active ? (
          <>
            <div className="px-4 h-14 border-b flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                {active.kind === 'channel' ? <Hash className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
              </div>
              <div>
                <div className="font-semibold text-sm">{active.title || 'Direct'}</div>
                <div className="text-[11px] text-muted-foreground capitalize">{active.kind}</div>
              </div>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => {
                const p = profiles[m.sender_id];
                const isMe = m.sender_id === user!.id;
                const rx = reactions[m.id] || [];
                const grouped: Record<string, number> = {};
                rx.forEach((r) => { grouped[r.emoji] = (grouped[r.emoji] || 0) + 1; });
                return (
                  <div key={m.id} className={`flex gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                      {(p?.full_name || '?')[0]}
                    </div>
                    <div className={`max-w-[70%] ${isMe ? 'items-end' : ''} flex flex-col gap-1`}>
                      <div className="text-[11px] text-muted-foreground">
                        {p?.full_name || 'User'} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                      </div>
                      <div className={`rounded-2xl px-3 py-2 text-sm ${isMe ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {m.body}
                        {(m.attachments || []).map((a: any) => (
                          <button key={a.path} onClick={async () => { const u = await attachmentUrl(a.path); if (u) window.open(u, '_blank'); }}
                            className="mt-2 block text-xs underline">
                            📎 {a.name}
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(grouped).map(([e, n]) => (
                          <button key={e} onClick={() => toggleReaction(m.id, e)}
                            className="text-xs px-1.5 py-0.5 rounded-full bg-muted border hover:bg-accent">
                            {e} {n}
                          </button>
                        ))}
                        <details className="relative">
                          <summary className="text-xs px-1.5 py-0.5 rounded-full bg-muted border cursor-pointer list-none"><Smile className="w-3 h-3" /></summary>
                          <div className="absolute z-10 bg-popover border rounded-md p-1 flex gap-1 shadow">
                            {EMOJIS.map((e) => <button key={e} onClick={() => toggleReaction(m.id, e)} className="hover:bg-muted rounded px-1">{e}</button>)}
                          </div>
                        </details>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!messages.length && <div className="text-center text-sm text-muted-foreground py-16">No messages yet — say hello 👋</div>}
            </div>
            <div className="border-t p-3 space-y-2">
              {file && <Badge variant="secondary">📎 {file.name} <button onClick={() => setFile(null)} className="ml-2">×</button></Badge>}
              <div className="flex gap-2 items-end">
                <label className="cursor-pointer p-2 hover:bg-muted rounded-md">
                  <Paperclip className="w-4 h-4" />
                  <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                </label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Type a message..." className="min-h-[44px] max-h-32" />
                <Button onClick={send}><Send className="w-4 h-4" /></Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a conversation</div>
        )}
      </div>
    </div>
  );
}
