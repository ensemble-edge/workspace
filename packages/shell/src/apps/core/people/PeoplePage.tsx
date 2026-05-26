/**
 * People Page — Member directory with invite + role management.
 */

import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSignals } from '@preact/signals-react/runtime';
import { Users, UserPlus, MoreHorizontal, Shield, Mail } from 'lucide-react';

import {
  Card,
  CardContent,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Avatar,
  AvatarFallback,
  Badge,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  toast,
} from '@ensemble-edge/ui';

import { isOwner, isAdmin, emitWorkspaceEvent } from '../../../state';
import { authedFetch } from '../../../state';

interface Member {
  id: string;
  email: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
  joined_at: string;
  /** v0.1.88: 1 = invite sent but user hasn't completed magic-link sign-in yet. */
  invite_pending?: number;
  /** v0.1.88: ISO timestamp of most-recent invite send (initial or resend). */
  invited_at?: string | null;
  /** v0.1.88: display name of the admin who issued the most recent invite. */
  invited_by_name?: string | null;
}

/**
 * v0.1.88: short relative time formatter for the Pending tooltip
 * ("Invited 3 days ago"). Pure utility — no i18n yet, English only.
 * If a more general formatter is needed later, lift into shared utils.
 */
function relativeTimeAgo(iso: string | null | undefined): string {
  if (!iso) return 'recently';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'recently';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function PeoplePage() {
  useSignals();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const canManage = isOwner.value || isAdmin.value;

  const fetchMembers = () => {
    authedFetch('/_ensemble/core/people/members')
      .then((res) => res.json() as Promise<{ data?: Member[] }>)
      .then((result) => {
        setMembers(result.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      const res = await authedFetch(`/_ensemble/core/people/members/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed');
      }
      emitWorkspaceEvent('user.role.changed', { user_id: userId, role });
      toast.success('Role updated');
      fetchMembers();
    } catch (err) {
      toast.error('Failed to update role', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleResend = async (userId: string, email: string) => {
    try {
      const res = await authedFetch(`/_ensemble/core/people/members/${userId}/resend-invite`, {
        method: 'POST',
      });
      const data = await res.json() as { success?: boolean; error?: string; email_sent?: boolean; email_reason?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to resend');
      if (data.email_sent) {
        toast.success('Invite resent', { description: `New invitation emailed to ${email}.` });
      } else {
        toast.error('Invite not sent', {
          description: data.email_reason === 'not_configured'
            ? 'Email is not configured. Set it up under Settings → Connections → Email.'
            : data.email_reason === 'unverified_domain'
              ? 'Sending domain is not verified yet.'
              : `Email provider error: ${data.email_reason ?? 'unknown'}.`,
        });
      }
      fetchMembers();
    } catch (err) {
      toast.error('Failed to resend invite', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from this workspace?`)) return;
    try {
      const res = await authedFetch(`/_ensemble/core/people/members/${userId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error || 'Failed');
      }
      toast.success('Member removed');
      fetchMembers();
    } catch (err) {
      toast.error('Failed to remove member', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const roleColors: Record<string, string> = {
    owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    admin: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    member: 'bg-green-500/10 text-green-500 border-green-500/20',
    viewer: 'bg-muted text-muted-foreground border-border',
    guest: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">People</h1>
          <p className="text-muted-foreground">
            {members.length} member{members.length !== 1 ? 's' : ''} in this workspace
          </p>
        </div>
        {canManage && (
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <InviteForm
                onSuccess={() => {
                  setInviteOpen(false);
                  fetchMembers();
                }}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-4 p-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No members yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                  <Avatar>
                    <AvatarFallback>
                      {getInitials(member.display_name || member.email)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {member.display_name || member.email.split('@')[0]}
                      </p>
                      {member.handle && (
                        <span className="text-sm text-muted-foreground">@{member.handle}</span>
                      )}
                      {member.invite_pending ? (
                        <Badge
                          variant="outline"
                          className="bg-amber-500/10 text-amber-600 border-amber-500/30"
                          title={`Invited ${relativeTimeAgo(member.invited_at)}${
                            member.invited_by_name ? ` by ${member.invited_by_name}` : ''
                          }. Has not signed in yet.`}
                        >
                          Pending
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>

                  <Badge variant="outline" className={roleColors[member.role] || ''}>
                    {member.role}
                  </Badge>

                  {canManage && member.role !== 'owner' && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {member.invite_pending ? (
                          <>
                            <DropdownMenuItem onClick={() => handleResend(member.id, member.email)}>
                              <Mail className="mr-2 h-4 w-4" /> Resend invite
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        ) : null}
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'admin')}>
                          <Shield className="mr-2 h-4 w-4" /> Make Admin
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'member')}>
                          Make Member
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'viewer')}>
                          Make Viewer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleRemove(member.id, member.display_name || member.email)}
                        >
                          Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function InviteForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState('member');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setSaving(true);
    try {
      const res = await authedFetch('/_ensemble/core/people/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, displayName: displayName || undefined, role }),
      });
      const data = await res.json() as {
        success?: boolean;
        error?: string;
        status?: string;
        email_sent?: boolean;
        email_reason?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Failed to invite');

      // v0.1.88: surface email-send result distinctly from the row-write
      // result. The user row + membership were created either way; what
      // matters to the admin is whether the magic-link email actually
      // went out. If it didn't, the People list shows a Pending row
      // with a Resend button — so they can recover after fixing the
      // email config.
      if (data.status === 'added') {
        toast.success('Member added', {
          description: `${email} was already a known account and has been added to the workspace.`,
        });
      } else if (data.email_sent) {
        toast.success('Invite sent', {
          description: `${email} has been emailed a magic-link invitation.`,
        });
      } else {
        toast.error('Invited, but email failed', {
          description: data.email_reason === 'not_configured'
            ? `${email} was added but no email was sent — email is not configured. Set it up under Settings → Connections → Email, then resend from the People list.`
            : data.email_reason === 'unverified_domain'
              ? `${email} was added but no email was sent — sending domain is not verified yet.`
              : `${email} was added but the email provider returned: ${data.email_reason ?? 'unknown error'}. Resend from the People list once resolved.`,
        });
      }
      onSuccess();
    } catch (err) {
      toast.error('Failed to invite', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Invite Member</DialogTitle>
        <DialogDescription>
          Add someone to this workspace. They'll get an account if they don't have one.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Name (optional)</Label>
          <Input
            id="invite-name"
            placeholder="Jane Doe"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="guest">Guest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button type="submit" disabled={saving || !email}>
          {saving ? 'Inviting...' : 'Send Invite'}
        </Button>
      </DialogFooter>
    </form>
  );
}

function getInitials(name: string): string {
  return name
    .split(/[\s@]+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
}
