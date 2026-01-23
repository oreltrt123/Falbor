import { auth } from "@clerk/nextjs/server";
import { Navbar } from "@/components/navbar/navbar";
import { InputArea } from "@/components/workbench/input-area";
import { Globe } from "@/components/ui/globe";
import Footer from "@/components/layout/footer";
import HeroSection from "@/components/layout/HeroSection";
import Features from '@/components/layout/features';
import FAQ from '@/components/layout/faq';
import HeroText from "@/components/layout/hero";
import CompanyLogos from "@/components/layout/LogsCompanySection";
import SidebarProjects from "@/components/project/SidebarProjects";
import { neon } from '@neondatabase/serverless';
import { Suspense } from 'react';

// Define the shape of each project (same as in SidebarProjects)
interface ProjectItem {
  id: string;
  title: string;
  updated_at: string;
  is_owner: boolean;
  collaborator_count?: number;
}

// Server-side data fetching function
async function getUserProjects(userId: string): Promise<ProjectItem[]> {
  const sql = neon(process.env.NEON_NEON_DATABASE_URL!);

  try {
    const owned = await sql`
      SELECT id, title, updated_at, TRUE AS is_owner,
      (SELECT COUNT(*) FROM project_collaborators pc WHERE pc.project_id = projects.id AND pc.status='accepted') AS collaborator_count
      FROM projects WHERE user_id = ${userId} ORDER BY updated_at DESC LIMIT 12
    ` as ProjectItem[];

    const collab = await sql`
      SELECT p.id, p.title, p.updated_at, FALSE AS is_owner, 0 AS collaborator_count
      FROM projects p
      JOIN project_collaborators pc ON p.id = pc.project_id
      WHERE pc.user_id = ${userId} AND pc.status='accepted'
      ORDER BY p.updated_at DESC LIMIT 12
    ` as ProjectItem[];

    // Combine and sort by updated_at descending
    return [...owned, ...collab].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );
  } catch (err) {
    console.error('Failed to fetch projects:', err);
    return []; // Return empty array on error → graceful fallback
  }
}

export default async function HomePage() {
  const { userId } = await auth();
  const isAuthenticated = !!userId;

  // Only fetch if authenticated
  let projects: ProjectItem[] = [];
  if (isAuthenticated && userId) {
    projects = await getUserProjects(userId);
  }

  return (
    <div className="relative min-h-screen flex flex-col bg-white overflow-hidden">
      <div className="relative z-10 flex flex-col min-h-screen">
        <main
          className="flex flex-1 flex-col items-center justify-center px-4 w-full"
          // style={{ ... }}  ← your commented background
        >
          <div className="absolute">
            {isAuthenticated && (
              <Suspense fallback={<div className="w-[350px] h-screen bg-gray-100/50 animate-pulse" />}>
                <SidebarProjects userId={userId!} initialProjects={projects} />
              </Suspense>
            )}
          </div>

          <div className="w-full flex flex-col items-center space-y-8 mt-[-140px] ml-5 relative z-10">
            {/* <img src="/bg/bg-text.png" ... /> ← keep commented if needed */}

            <div className="w-full flex flex-col mt-[-140px] items-center space-y-3 z-10">
              <HeroText />
              <div className="w-full flex justify-center">
                <div className="w-full sm:w-[55%] md:w-[45%] lg:w-[35%] xl:w-[30%]">
                  <InputArea isAuthenticated={isAuthenticated} />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="top-[-10px] relative">
        {!userId && <HeroSection />}
      </div>
      <div className="top-[-60px] relative">
        {!userId && <FAQ />}
      </div>
      <div className="top-[-60px] relative">
        {!userId && <CompanyLogos />}
      </div>

      <Footer />
    </div>
  );
}