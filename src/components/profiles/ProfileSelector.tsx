import React from 'react';
import { useTranslation } from 'react-i18next';
import { ModProfile } from '../../types/profiles.ts';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { User, ChevronDown, Check, Settings } from 'lucide-react';

interface ProfileSelectorProps {
  profiles: ModProfile[];
  activeProfile: ModProfile | null;
  onProfileChange: (profileId: string) => void;
  onManageProfiles: () => void;
}

const ProfileSelector: React.FC<ProfileSelectorProps> = ({
  profiles,
  activeProfile,
  onProfileChange,
  onManageProfiles,
}) => {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <User className="h-4 w-4" />
          <span>{activeProfile ? activeProfile.name : t('profiles.noProfileSelected')}</span>
          <ChevronDown className="h-4 w-4" /> {/* La rotazione è gestita da DropdownMenu */}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('profiles.availableProfiles')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {profiles.length === 0 && (
          <DropdownMenuItem disabled>{t('profiles.noProfilesCreated')}</DropdownMenuItem>
        )}
        {profiles.map((profile) => (
          <DropdownMenuItem
            key={profile.id}
            onClick={() => onProfileChange(profile.id)}
            className="flex items-center justify-between"
          >
            <span>{profile.name}</span>
            {activeProfile?.id === profile.id && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onManageProfiles}
          className="flex items-center gap-2"
        >
          <Settings className="h-4 w-4" />
          <span>{t('profiles.manageProfilesAction')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ProfileSelector;