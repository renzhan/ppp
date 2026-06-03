'use client';

import { useRouter } from 'next/navigation';
import { ChangePasswordModal } from '@/components/auth/change-password-modal';

export default function ChangePasswordPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#FFF8E1] to-[#FFECB3] px-4">
      <ChangePasswordModal
        open
        embedded
        requireChange
        onSuccess={() => router.push('/')}
      />
    </div>
  );
}
