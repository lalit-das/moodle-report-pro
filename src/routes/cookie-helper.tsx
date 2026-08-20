import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, ClipboardPaste, Loader2, XCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { validateCookie } from "@/lib/moodle.functions";

export const Route = createFileRoute("/cookie-helper")({
  head: () => ({
    meta: [
      { title: "Cookie Helper | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Step-by-step guide to copying your MoodleSession cookie in Chrome, Firefox or Edge, with instant validation.",
      },
      { property: "og:title", content: "How to get your MoodleSession cookie" },
      {
        property: "og:description",
        content: "Browser-by-browser instructions for finding the MoodleSession cookie value.",
      },
    ],
  }),
  component: CookieHelper,
});


const GUIDES: Record<string, { title: string; steps: string[] }> = {
  chrome: {
    title: "Google Chrome",
    steps: [
      "Sign in at https://rulms.reva.edu.in and keep the tab open.",
      "Press F12 to open DevTools, then open the Application tab.",
      "In the left sidebar expand Storage → Cookies → https://rulms.reva.edu.in.",
      "Find the row named MoodleSession and copy its Value column.",
      "Paste it into the extractor and validate.",
    ],
  },
  firefox: {
    title: "Mozilla Firefox",
    steps: [
      "Sign in at https://rulms.reva.edu.in.",
      "Press F12 and open the Storage tab.",
      "Expand Cookies → https://rulms.reva.edu.in.",
      "Select MoodleSession and copy the Value field.",
      "Paste it into the extractor and validate.",
    ],
  },
  edge: {
    title: "Microsoft Edge",
    steps: [
      "Sign in at https://rulms.reva.edu.in.",
      "Press F12 and open the Application tab.",
      "Expand Cookies → https://rulms.reva.edu.in.",
      "Copy the Value of MoodleSession.",
      "Paste it into the extractor and validate.",
    ],
  },
};

function CookieHelper() {
  const [cookie, setCookie] = useState("");
  const [url, setUrl] = useState("https://rulms.reva.edu.in");
  const [result, setResult] = useState<{ valid: boolean; username: string | null; message: string } | null>(
    null,
  );
  const [checking, setChecking] = useState(false);
  const validate = useServerFn(validateCookie);

  const check = async () => {
    setChecking(true);
    try {
      setResult(await validate({ data: { moodle_url: url, session_cookie: cookie } }));
    } catch {
      setResult({ valid: false, username: null, message: "Validation request failed." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cookie helper</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The extractor reads Moodle pages as you, using your active session cookie. It is never
            stored on a server.
          </p>
        </div>

        <Tabs defaultValue="chrome" className="surface-card p-6">
          <TabsList>
            {Object.entries(GUIDES).map(([key, guide]) => (
              <TabsTrigger key={key} value={key}>
                {guide.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {Object.entries(GUIDES).map(([key, guide]) => (
            <TabsContent key={key} value={key} className="pt-4">
              <ol className="space-y-3">
                {guide.steps.map((stepText, i) => (
                  <li key={i} className="flex gap-3 rounded-lg bg-secondary/50 p-3">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {i + 1}
                    </span>
                    <span className="text-sm text-secondary-foreground">{stepText}</span>
                  </li>
                ))}
              </ol>
            </TabsContent>
          ))}
        </Tabs>

        <div className="surface-card flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-medium">Already copied it?</p>
            <p className="text-xs text-muted-foreground">
              Paste the value here to confirm the session works before starting an extraction.
            </p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <ClipboardPaste className="size-4" />
                Paste &amp; validate cookie
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Validate MoodleSession cookie</DialogTitle>
                <DialogDescription>
                  The cookie is sent once to read your Moodle profile page and is not saved.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="helper-url">Moodle URL</Label>
                  <Input id="helper-url" value={url} onChange={(e) => setUrl(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="helper-cookie">MoodleSession value</Label>
                  <Input
                    id="helper-cookie"
                    type="password"
                    value={cookie}
                    onChange={(e) => setCookie(e.target.value)}
                  />
                </div>
                <Button onClick={() => void check()} disabled={checking || !cookie.trim()}>
                  {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                  Validate
                </Button>
                {result ? (
                  <p
                    className={
                      result.valid
                        ? "flex items-center gap-2 text-sm font-medium text-success"
                        : "flex items-center gap-2 text-sm font-medium text-destructive"
                    }
                  >
                    {result.valid ? (
                      <CheckCircle2 className="size-4" />
                    ) : (
                      <XCircle className="size-4" />
                    )}
                    {result.valid
                      ? `Session active${result.username ? ` — ${result.username}` : ""}`
                      : result.message}
                  </p>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppShell>
  );
}
