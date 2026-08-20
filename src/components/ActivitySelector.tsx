import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { GripVertical, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchNames } from "@/lib/moodle.functions";
import type { Activity, ActivityType } from "@/lib/types";

export function parseActivityIds(text: string): string[] {
  return text
    .split(/\r?\n|,|\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((token) => token.match(/id=(\d+)/i)?.[1] ?? token.match(/\d+/)?.[0] ?? "")
    .filter(Boolean);
}

export function ActivitySelector({
  type,
  moodleUrl,
  cookie,
  activities,
  selected,
  onActivitiesChange,
  onSelectedChange,
}: {
  type: ActivityType;
  moodleUrl: string;
  cookie: string;
  activities: Activity[];
  selected: string[];
  onActivitiesChange: (list: Activity[]) => void;
  onSelectedChange: (ids: string[]) => void;
}) {
  const [manual, setManual] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const getNames = useServerFn(fetchNames);

  const addManual = async (withNames: boolean) => {
    const ids = parseActivityIds(manual).filter((id) => !activities.some((a) => a.id === id));
    if (!ids.length) return;
    let added: Activity[] = ids.map((id) => ({ id, name: `${type.toUpperCase()} ${id}`, type }));
    if (withNames && cookie) {
      setLoading(true);
      try {
        const { names } = await getNames({
          data: {
            moodle_url: moodleUrl,
            session_cookie: cookie,
            items: ids.map((id) => ({ id, type })),
          },
        });
        added = names.map((n) => ({ id: n.id, name: n.name, type }));
      } finally {
        setLoading(false);
      }
    }
    onActivitiesChange([...activities, ...added]);
    onSelectedChange([...selected, ...added.map((a) => a.id)]);
    setManual("");
  };

  const reorder = (from: number, to: number) => {
    const next = [...activities];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(to, 0, moved);
    onActivitiesChange(next);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {selected.length} of {activities.length} selected
        </Badge>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onSelectedChange(activities.map((a) => a.id))}
        >
          Select all
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onSelectedChange([])}>
          Deselect all
        </Button>
      </div>

      <div className="space-y-2">
        {activities.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No {type.toUpperCase()} activities yet. Auto-discover from a course ID or paste IDs/URLs
            below.
          </p>
        ) : (
          activities.map((activity, index) => (
            <div
              key={activity.id}
              draggable
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIndex !== null && dragIndex !== index) reorder(dragIndex, index);
                setDragIndex(null);
              }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <Checkbox
                id={`act-${type}-${activity.id}`}
                checked={selected.includes(activity.id)}
                onCheckedChange={(checked) =>
                  onSelectedChange(
                    checked
                      ? [...selected, activity.id]
                      : selected.filter((id) => id !== activity.id),
                  )
                }
              />
              <Label htmlFor={`act-${type}-${activity.id}`} className="flex-1 cursor-pointer">
                <span className="block text-sm font-medium">{activity.name}</span>
                <span className="block text-xs text-muted-foreground">ID {activity.id}</span>
              </Label>
              <Badge variant={type === "vpl" ? "default" : "secondary"}>
                {type.toUpperCase()}
              </Badge>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`manual-${type}`}>Add manually (IDs or activity URLs, one per line)</Label>
        <Textarea
          id={`manual-${type}`}
          rows={3}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          placeholder={`24261\nhttps://rulms.reva.edu.in/mod/${type}/view.php?id=24262`}
          className="font-mono text-xs"
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void addManual(false)}>
            Add IDs
          </Button>
          <Button type="button" size="sm" onClick={() => void addManual(true)} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Fetch names
          </Button>
        </div>
      </div>
    </div>
  );
}
