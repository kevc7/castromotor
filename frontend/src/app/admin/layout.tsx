"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Permitir /admin/login sin token
    if (pathname?.startsWith("/admin/login")) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;
    if (!token) router.replace('/admin/login');
  }, [pathname, router]);

  return <>{children}</>;
}


