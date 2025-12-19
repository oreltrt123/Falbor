"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface Props {
  params: { id: string };
}

export default function Page({ params }: Props) {
  const router = useRouter();
  const projectId = params.id;

  useEffect(() => {
    if (!projectId) {
      console.error("No projectId param found");
      return;
    }

    console.log("Got projectId:", projectId);

    // Call your backend API to connect
    fetch("/api/webcontainer/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    })
      .then(res => res.json())
      .then(data => {
        console.log("API response:", data);
        if (data.success) {
          router.replace("/"); // or redirect to dashboard
        } else {
          router.replace("/connect-error");
        }
      })
      .catch(err => {
        console.error("Error connecting:", err);
        router.replace("/connect-error");
      });
  }, [projectId, router]);

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center">
      <h1>Connecting project…</h1>
      <p>Project ID: {projectId}</p>
      <div className="mt-6 h-8 w-8 border-4 border-gray-300 border-t-black rounded-full animate-spin" />
    </div>
  );
}
