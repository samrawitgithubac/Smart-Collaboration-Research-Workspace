import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type FormEvent, useMemo, useState } from "react";
import { apiJson, type Task, type TaskStatus } from "../../models";

const COLUMNS: { id: TaskStatus; title: string }[] = [
  { id: "TODO", title: "To do" },
  { id: "IN_PROGRESS", title: "In progress" },
  { id: "REVIEW", title: "Review" },
  { id: "DONE", title: "Done" },
];

function SortableTask({
  task,
  onDelete,
  canDelete,
}: {
  task: Task;
  onDelete: (id: string) => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} className="task-card" {...attributes} {...listeners}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "start" }}>
        <strong style={{ fontSize: "0.9rem" }}>{task.title}</strong>
        {canDelete ? (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "0.1rem 0.35rem", fontSize: "0.7rem" }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onDelete(task.id)}
          >
            ×
          </button>
        ) : null}
      </div>
      {task.assignee ? (
        <p className="muted" style={{ margin: "0.25rem 0 0" }}>
          {task.assignee.name}
        </p>
      ) : null}
    </div>
  );
}

function ColumnDrop({
  status,
  title,
  children,
}: {
  status: TaskStatus;
  title: string;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className="column"
      style={{
        outline: isOver ? "2px solid #6366f1" : undefined,
        background: isOver ? "#eef2ff" : undefined,
      }}
    >
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function KanbanBoard({
  workspaceId,
  tasks,
  onTasksChange,
  members,
  currentUserId,
  isAdmin,
}: {
  workspaceId: string;
  tasks: Task[];
  onTasksChange: (tasks: Task[]) => void;
  members: Array<{ user: { id: string; name: string } }>;
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState<string>("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const grouped = useMemo(() => {
    const map: Record<TaskStatus, Task[]> = {
      TODO: [],
      IN_PROGRESS: [],
      REVIEW: [],
      DONE: [],
    };
    for (const t of tasks) {
      map[t.status].push(t);
    }
    for (const s of COLUMNS) {
      map[s.id].sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [tasks]);

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  async function persistOrder(prev: Task[], next: Task[]) {
    onTasksChange(next);
    const updates: Promise<unknown>[] = [];
    for (const t of next) {
      const p = prev.find((x) => x.id === t.id);
      if (!p || p.status !== t.status || p.position !== t.position) {
        updates.push(
          apiJson(`/api/workspaces/${workspaceId}/tasks/${t.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: t.status, position: t.position }),
          })
        );
      }
    }
    try {
      await Promise.all(updates);
    } catch (e) {
      console.error(e);
    }
  }

  function onDragStart(ev: DragStartEvent) {
    setActiveId(String(ev.active.id));
  }

  function onDragEnd(ev: DragEndEvent) {
    setActiveId(null);
    const { active, over } = ev;
    if (!over) return;

    const activeTaskId = String(active.id);
    const task = tasks.find((t) => t.id === activeTaskId);
    if (!task) return;

    const overId = String(over.id);
    let targetStatus: TaskStatus;
    let insertBeforeId: string | null = null;

    if (COLUMNS.some((c) => c.id === overId)) {
      targetStatus = overId as TaskStatus;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      if (!overTask) return;
      targetStatus = overTask.status;
      if (overTask.id !== activeTaskId) insertBeforeId = overTask.id;
    }

    const without = tasks.filter((t) => t.id !== activeTaskId);
    const inTarget = without
      .filter((t) => t.status === targetStatus)
      .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));

    let insertIndex = inTarget.length;
    if (insertBeforeId) {
      const idx = inTarget.findIndex((t) => t.id === insertBeforeId);
      if (idx >= 0) insertIndex = idx;
    }

    const newTarget = [
      ...inTarget.slice(0, insertIndex),
      { ...task, status: targetStatus },
      ...inTarget.slice(insertIndex),
    ];

    const next: Task[] = [];
    for (const col of COLUMNS) {
      const list =
        col.id === targetStatus
          ? newTarget
          : without
              .filter((t) => t.status === col.id)
              .sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
      list.forEach((t, position) => {
        next.push({ ...t, status: col.id, position });
      });
    }

    void persistOrder(tasks, next);
  }

  async function addTask(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const res = await apiJson<{ task: Task }>(`/api/workspaces/${workspaceId}/tasks`, {
      method: "POST",
      body: JSON.stringify({
        title: title.trim(),
        assigneeId: assigneeId || undefined,
      }),
    });
    onTasksChange([...tasks, res.task]);
    setTitle("");
    setAssigneeId("");
  }

  async function deleteTask(id: string) {
    await apiJson(`/api/workspaces/${workspaceId}/tasks/${id}`, { method: "DELETE" });
    onTasksChange(tasks.filter((t) => t.id !== id));
  }

  return (
    <div>
      <form onSubmit={addTask} className="card" style={{ marginBottom: "0.75rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-end" }}>
          <div className="field" style={{ flex: "1 1 200px", marginBottom: 0 }}>
            <label>New task</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
          </div>
          <div className="field" style={{ flex: "0 1 180px", marginBottom: 0 }}>
            <label>Assignee</label>
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">—</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">
            Add
          </button>
        </div>
      </form>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="kanban">
          {COLUMNS.map((col) => (
            <ColumnDrop key={col.id} status={col.id} title={col.title}>
              <SortableContext items={grouped[col.id].map((t) => t.id)} strategy={verticalListSortingStrategy}>
                {grouped[col.id].map((t) => (
                  <SortableTask
                    key={t.id}
                    task={t}
                    onDelete={deleteTask}
                    canDelete={isAdmin || t.createdById === currentUserId}
                  />
                ))}
              </SortableContext>
            </ColumnDrop>
          ))}
        </div>
        <DragOverlay>{activeTask ? <div className="task-card">{activeTask.title}</div> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
