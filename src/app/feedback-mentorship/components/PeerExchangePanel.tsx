'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

export default function PeerExchangePanel() {
  const [newPost, setNewPost] = useState('');

  const handlePost = () => {
    if (!newPost?.trim()) return;
    toast?.success('Post submitted to peer exchange', { description: 'Your question is now visible to all staff.' });
    setNewPost('');
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <div>
          <h3 className="text-sm font-700 text-foreground">Peer Exchange</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Knowledge sharing by strategic priority</p>
        </div>
        <span className="text-[11px] bg-muted text-muted-foreground px-2 py-1 rounded-md font-500">
          0 replies this month
        </span>
      </div>
      {/* Quick post */}
      <div className="p-4 border-b border-border bg-muted/20">
        <div className="flex gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="UserIcon" size={14} className="text-primary" />
          </div>
          <div className="flex-1">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e?.target?.value)}
              placeholder="Share a question, insight, or best practice with your peers..."
              className="w-full px-3 py-2 text-sm bg-white border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
              rows={2}
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handlePost}
                disabled={!newPost?.trim()}
                className="text-xs font-600 text-white bg-primary px-3 py-1.5 rounded-md hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post to Exchange
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Empty state */}
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Icon name="ChatBubbleLeftIcon" size={32} className="text-muted-foreground/40" />
        <p className="text-sm font-600 text-foreground">No discussions yet</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          Be the first to start a peer exchange discussion.
        </p>
      </div>
    </div>
  );
}