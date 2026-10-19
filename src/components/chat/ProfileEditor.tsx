'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import type { AIProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface ProfileEditorProps {
  currentProfile: AIProfile;
  onSave: (updatedProfile: Partial<AIProfile>) => void;
  onClose: () => void;
  isAdminEditor?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  currentProfile,
  onSave,
  isAdminEditor = false,
  isOpen,
  onOpenChange,
}) => {
  const [name, setName] = useState(currentProfile.name);
  const [status, setStatus] = useState(currentProfile.status);
  const [avatarUrlInput, setAvatarUrlInput] = useState(currentProfile.avatarUrl || ''); // Ensure it's a string

  useEffect(() => {
    if (isOpen) {
      setName(currentProfile.name);
      setStatus(currentProfile.status);
      setAvatarUrlInput(currentProfile.avatarUrl || ''); // Ensure it's a string on open
    }
  }, [currentProfile, isOpen]);

  const handleSave = () => {
    const profileUpdate: Partial<AIProfile> = {
      status,
      avatarUrl: avatarUrlInput.trim() === '' ? undefined : avatarUrlInput.trim(),
    };
    if (isAdminEditor) {
      profileUpdate.name = name;
    }
    onSave(profileUpdate);
    onOpenChange(false);
  };

  // Basic check for a valid-looking URL for preview
  const isValidPreviewUrl = (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-w-full" aria-describedby="profile-editor-description">
        <DialogHeader>
          <DialogTitle>Edit {isAdminEditor ? name : currentProfile.name}'s Profile</DialogTitle>
          <DialogDescription id="profile-editor-description">
            Customize Kruthika's personality, appearance, and behavior settings.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => isAdminEditor && setName(e.target.value)}
              className="col-span-3"
              readOnly={!isAdminEditor}
              disabled={!isAdminEditor}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Textarea
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="col-span-3 min-h-[60px]"
              placeholder={`How is ${isAdminEditor ? name : currentProfile.name} feeling today?`}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
            <Label htmlFor="avatarUrl" className="text-right">
              Avatar URL
            </Label>
            <Input
              id="avatarUrl"
              value={avatarUrlInput}
              onChange={(e) => setAvatarUrlInput(e.target.value)}
              className="col-span-3"
              placeholder="https://example.com/avatar.png"
            />
          </div>
          {isValidPreviewUrl(avatarUrlInput) && (
            <div className="grid grid-cols-2 md:grid-cols-4 items-center gap-4">
              <Label className="text-right">Preview</Label>
              <div className="col-span-3">
                <Image
                  src={avatarUrlInput}
                  alt="Avatar Preview"
                  width={80}
                  height={80}
                  className="rounded-full border"
                  // The preview src is whatever host the operator typed. Running it
                  // through the optimizer makes next/image throw "hostname is not
                  // configured under images in your next.config.js" mid-render,
                  // which takes down the whole editor dialog instead of just
                  // failing to load one thumbnail.
                  unoptimized
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://placehold.co/100x100.png/CCCCCC/FFFFFF?text=Error';
                  }}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProfileEditor;