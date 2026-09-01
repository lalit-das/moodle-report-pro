import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2, Radar, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { StepWizard } from "@/components/StepWizard";
import { CookieInput, type CookieValidation } from "@/components/CookieInput";
import { StudentListInput, parseStudentText } from "@/components/StudentListInput";
import { ActivitySelector } from "@/components/ActivitySelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { discoverActivities } from "@/lib/moodle.functions";
import { previewSheetNames } from "@/lib/excel";
import { presetStore, jobStore } from "@/lib/job-store";
import { MAX_CONCURRENT_JOBS, createJob, useExtraction } from "@/hooks/useExtraction";
import type { Activity } from "@/lib/types";

export const Route = createFileRoute("/new")({
  head: () => ({
    meta: [
      { title: "New Extraction | REVA VPL & Quiz Report Extractor" },
      {
        name: "description",
        content:
          "Four-step wizard: connect to Moodle, choose a section and students, pick VPL and quiz activities, then export the Excel report.",
      },
      { property: "og:title", content: "New extraction wizard" },
      {
        property: "og:description",
        content: "Configure a Moodle VPL and quiz extraction job in four guided steps.",
      },
    ],
  }),
  component: NewExtraction,
});

import { ALL_SECTIONS } from "@/lib/faculty";

const STEPS = ["Moodle Connection", "Section & Students", "Activities", "Output Settings"];
const SECTIONS = ALL_SECTIONS;

function NewExtraction() {
  const navigate = useNavigate();
  const { run } = useExtraction();
  const discover = useServerFn(discoverActivities);

  const [step, setStep] = useState(0);
  const [moodleUrl, setMoodleUrl] = useState("https://rulms.reva.edu.in");
  const [cookie, setCookie] = useState("");
  const [validation, setValidation] = useState<CookieValidation | null>(null);
  const [courseId, setCourseId] = useState("");
  const [discovering, setDiscovering] = useState(false);

  const [section, setSection] = useState("CSE-A");
  const [mode, setMode] = useState<1 | 2>(1);
  const [studentText, setStudentText] = useState("");

  const [vplActivities, setVplActivities] = useState<Activity[]>([]);
  const [quizActivities, setQuizActivities] = useState<Activity[]>([]);
  const [vplSelected, setVplSelected] = useState<string[]>([]);
  const [quizSelected, setQuizSelected] = useState<string[]>([]);

  const [filename, setFilename] = useState("CSE_A_Report");
  const [starting, setStarting] = useState(false);

  const students = useMemo(() => parseStudentText(studentText), [studentText]);
  const selectedActivities = useMemo(
    () => [
      ...vplActivities.filter((a) => vplSelected.includes(a.id)),
      ...quizActivities.filter((a) => quizSelected.includes(a.id)),
    ],
    [vplActivities, quizActivities, vplSelected, quizSelected],
  );

  useEffect(() => {
    setFilename(`${section.replace(/-/g, "_")}_Report`);
  }, [section]);

  const runDiscovery = async (id: string) => {
    if (!id.trim() || !cookie.trim()) return;
    setDiscovering(true);
    try {
      const result = await discover({
        data: { moodle_url: moodleUrl, session_cookie: cookie, course_id: id.trim() },
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setVplActivities(result.vpl_activities);
      setQuizActivities(result.quiz_activities);
      setVplSelected(result.vpl_activities.map((a) => a.id));
      setQuizSelected(result.quiz_activities.map((a) => a.id));
      toast.success(
        `Found ${result.vpl_activities.length} VPL and ${result.quiz_activities.length} quiz activities`,
      );
    } catch {
      toast.error("Activity discovery failed. Check the course ID and your session cookie.");
    } finally {
      setDiscovering(false);
    }
  };

  // Auto-discovery once a plausible course ID has been typed.
  useEffect(() => {
    if (!courseId.trim() || !validation?.valid) return;
    const timer = window.setTimeout(() => void runDiscovery(courseId), 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, validation?.valid]);

  const loadPreset = (name: string) => {
    setSection(name);
    const preset = presetStore.get(name);
    if (preset) {
      setStudentText(preset.students.map((s) => `${s.roll_no}\t${s.name}`).join("\n"));
      toast.success(`Loaded ${preset.students.length} saved students for ${name}`);
    }
  };

  const estimateMinutes = Math.max(
    1,
    Math.round(
      (selectedActivities.length * Math.max(students.length || 50, 10) * 0.35) / 60,
    ),
  );

  const startExtraction = async () => {
    if (!validation?.valid) {
      toast.error("Validate your Moodle session cookie first.");
      setStep(0);
      return;
    }
    if (!selectedActivities.length) {
      toast.error("Select at least one VPL or quiz activity.");
      setStep(2);
      return;
    }
    if (jobStore.activeCount() >= MAX_CONCURRENT_JOBS) {
      toast.error(`Maximum ${MAX_CONCURRENT_JOBS} concurrent jobs. Wait for one to finish.`);
      return;
    }
    if (mode === 1 && students.length) {
      presetStore.save({ section, students });
    }

    setStarting(true);
    const job = createJob({
      moodle_url: moodleUrl,
      session_cookie: cookie,
      section_name: section,
      extraction_mode: mode,
      activities: selectedActivities,
      students: mode === 1 ? students : [],
      output_filename: filename,
    });
    void run(job.job_id, cookie).catch(() => undefined);
    navigate({ to: "/progress/$jobId", params: { jobId: job.job_id } });
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New extraction</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Four steps from a Moodle session cookie to a styled Excel report.
          </p>
        </div>

        <StepWizard steps={STEPS} current={step} onStepClick={setStep} />

        <div className="surface-card p-6">
          {step === 0 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="moodle-url">Moodle URL</Label>
                <Input
                  id="moodle-url"
                  value={moodleUrl}
                  onChange={(e) => setMoodleUrl(e.target.value)}
                />
              </div>

              <CookieInput
                moodleUrl={moodleUrl}
                cookie={cookie}
                onCookieChange={setCookie}
                validation={validation}
                onValidation={setValidation}
              />

              <Collapsible>
                <CollapsibleTrigger className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                  How do I get the MoodleSession cookie?
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-2 rounded-lg bg-secondary/60 p-4 text-sm text-secondary-foreground">
                  <p>1. Sign in to Moodle in your browser.</p>
                  <p>
                    2. Press <strong>F12</strong> → <strong>Application</strong> (Chrome/Edge) or{" "}
                    <strong>Storage</strong> (Firefox).
                  </p>
                  <p>
                    3. Open <strong>Cookies</strong> → your Moodle domain.
                  </p>
                  <p>
                    4. Copy the <strong>Value</strong> of <code>MoodleSession</code> and paste it
                    above.
                  </p>
                </CollapsibleContent>
              </Collapsible>

              <div className="space-y-2">
                <Label htmlFor="course-id">Course ID (optional — auto-discovers activities)</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    id="course-id"
                    value={courseId}
                    placeholder="565"
                    onChange={(e) => setCourseId(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runDiscovery(courseId)}
                    disabled={discovering || !courseId.trim()}
                  >
                    {discovering ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Radar className="size-4" />
                    )}
                    Auto-discover Activities
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="section">Section name</Label>
                <Input id="section" value={section} onChange={(e) => setSection(e.target.value)} />
                <div className="flex flex-wrap gap-2 pt-1">
                  {SECTIONS.map((name) => (
                    <Button
                      key={name}
                      type="button"
                      size="sm"
                      variant={section === name ? "default" : "outline"}
                      onClick={() => loadPreset(name)}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border p-4">
                <div>
                  <p className="text-sm font-medium">
                    {mode === 1 ? "Mode 1 — specific students" : "Mode 2 — all enrolled students"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {mode === 1
                      ? "Results are filtered and matched to your student list."
                      : "Every student found in Moodle is included."}
                  </p>
                </div>
                <Switch checked={mode === 2} onCheckedChange={(v) => setMode(v ? 2 : 1)} />
              </div>

              {mode === 1 ? (
                <StudentListInput value={studentText} onChange={setStudentText} />
              ) : (
                <p className="rounded-lg bg-secondary/60 p-4 text-sm text-secondary-foreground">
                  All enrolled students found on each activity page will be extracted. Roll numbers
                  are detected from Moodle display names where present.
                </p>
              )}
            </div>
          ) : null}

          {step === 2 ? (
            <Tabs defaultValue="vpl">
              <TabsList>
                <TabsTrigger value="vpl">VPL Activities</TabsTrigger>
                <TabsTrigger value="quiz">Quiz Activities</TabsTrigger>
              </TabsList>
              <TabsContent value="vpl" className="pt-4">
                <ActivitySelector
                  type="vpl"
                  moodleUrl={moodleUrl}
                  cookie={cookie}
                  activities={vplActivities}
                  selected={vplSelected}
                  onActivitiesChange={setVplActivities}
                  onSelectedChange={setVplSelected}
                />
              </TabsContent>
              <TabsContent value="quiz" className="pt-4">
                <ActivitySelector
                  type="quiz"
                  moodleUrl={moodleUrl}
                  cookie={cookie}
                  activities={quizActivities}
                  selected={quizSelected}
                  onActivitiesChange={setQuizActivities}
                  onSelectedChange={setQuizSelected}
                />
              </TabsContent>
            </Tabs>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="filename">Output filename</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="filename"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                  />
                  <span className="text-sm text-muted-foreground">.xlsx</span>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Activities</p>
                  <p className="text-2xl font-bold">{selectedActivities.length}</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Students</p>
                  <p className="text-2xl font-bold">
                    {mode === 1 ? students.length : "All"}
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-xs text-muted-foreground">Estimated time</p>
                  <p className="text-2xl font-bold">~{estimateMinutes} min</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Sheets that will be generated</p>
                <div className="flex flex-wrap gap-2">
                  {previewSheetNames(selectedActivities).map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full text-base"
                onClick={() => void startExtraction()}
                disabled={starting}
              >
                {starting ? <Loader2 className="size-5 animate-spin" /> : <Rocket className="size-5" />}
                Start Extraction
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <Button
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            disabled={step === STEPS.length - 1}
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
