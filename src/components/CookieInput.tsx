import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { validateCookie } from "@/lib/moodle.functions";

export interface CookieValidation {
  valid: boolean;
  username: string | null;
  message: string;
}

export function CookieInput({
  moodleUrl,
  cookie,
  onCookieChange,
  validation,
  onValidation,
}: {
  moodleUrl: string;
  cookie: string;
  onCookieChange: (value: string) => void;
  validation: CookieValidation | null;
  onValidation: (value: CookieValidation | null) => void;
}) {
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const validate = useServerFn(validateCookie);

  const runValidation = async () => {
    if (!cookie.trim() || !moodleUrl.trim()) return;
    setChecking(true);
    try {
      const result = await validate({
        data: { moodle_url: moodleUrl, session_cookie: cookie },
      });
      onValidation(result);
    } catch {
      onValidation({ valid: false, username: null, message: "Validation request failed." });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="cookie">MoodleSession Cookie</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Input
            id="cookie"
            type={show ? "text" : "password"}
            value={cookie}
            placeholder="e.g. 8f3ab1c9d2e4…"
            autoComplete="off"
            onChange={(e) => {
              onCookieChange(e.target.value);
              onValidation(null);
            }}
            onBlur={runValidation}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Hide cookie" : "Show cookie"}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <Button type="button" onClick={runValidation} disabled={checking || !cookie.trim()}>
          {checking ? <Loader2 className="size-4 animate-spin" /> : null}
          Validate Cookie
        </Button>
      </div>

      {validation ? (
        validation.valid ? (
          <p className="flex items-center gap-2 text-sm font-medium text-success">
            <CheckCircle2 className="size-4" />
            Session active{validation.username ? ` — ${validation.username}` : ""}
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm font-medium text-destructive">
            <XCircle className="size-4" />
            {validation.message}
          </p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">
          Validation runs automatically when you leave the field.
        </p>
      )}
    </div>
  );
}
