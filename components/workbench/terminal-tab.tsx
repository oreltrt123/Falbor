import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Terminal } from "./terminal"
import type { WebContainer } from "@webcontainer/api"

interface TerminalTabProps {
  container: WebContainer | null
  projectId: string
}

export function TerminalTab({ container, projectId }: TerminalTabProps) {
  return (
    <Tabs defaultValue="terminal">
      <TabsContent value="terminal" className="flex-1 m-0 overflow-hidden">
        <Terminal container={container} projectId={projectId} />
      </TabsContent>
    </Tabs>
  )
}
