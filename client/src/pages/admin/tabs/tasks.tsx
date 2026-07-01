import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, ListChecks, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface Task {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  xnrtReward: string;
  category: string;
  requirements: string | null;
  missionType: string;
  triggerKey: string;
  targetCount: number;
  sortOrder: number;
  isActive: boolean;
  completionCount: number;
}

const MISSION_TRIGGERS = [
  { value: "manual", label: "Manual / Button" },
  { value: "daily_checkin_claimed", label: "Daily check-in claimed" },
  { value: "mining_started", label: "Mining started" },
  { value: "mining_completed", label: "Mining completed" },
  { value: "wallet_opened", label: "Wallet opened" },
  { value: "staking_rewards_viewed", label: "Staking viewed" },
  { value: "safety_tip_read", label: "Safety tip read" },
  { value: "stake_created", label: "Stake created" },
  { value: "referral_created", label: "Referral created" },
];

const emptyFormData = {
  title: "",
  description: "",
  xpReward: "",
  xnrtReward: "0",
  category: "daily",
  missionType: "daily",
  triggerKey: "manual",
  targetCount: "1",
  sortOrder: "100",
  requirements: "",
  isActive: true,
};

export default function TasksTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [formData, setFormData] = useState(emptyFormData);

  const { data: tasks, isLoading } = useQuery<Task[]>({
    queryKey: ["/api/admin/tasks"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/tasks", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      setCreateDialogOpen(false);
      setFormData(emptyFormData);
      toast({ title: "Success", description: "Task created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create task", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PUT", `/api/admin/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      setEditDialogOpen(false);
      setSelectedTask(null);
      toast({ title: "Success", description: "Task updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update task", variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/admin/tasks/${id}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      toast({ title: "Success", description: "Task status toggled successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle task", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/tasks/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tasks"] });
      setDeleteDialogOpen(false);
      setSelectedTask(null);
      toast({ title: "Success", description: "Task deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    },
  });

  const filteredTasks = tasks?.filter((task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || task.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (task: Task) => {
    setSelectedTask(task);
    setFormData({
      title: task.title,
      description: task.description,
      xpReward: task.xpReward.toString(),
      xnrtReward: task.xnrtReward,
      category: task.category,
      missionType: task.missionType || "one_time",
      triggerKey: task.triggerKey || "manual",
      targetCount: String(task.targetCount || 1),
      sortOrder: String(task.sortOrder || 0),
      requirements: task.requirements || "",
      isActive: task.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (task: Task) => {
    setSelectedTask(task);
    setDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-tasks"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="onboarding">Onboarding</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="staking">Staking</SelectItem>
              <SelectItem value="mining">Mining</SelectItem>
              <SelectItem value="referrals">Referrals</SelectItem>
              <SelectItem value="wallet">Wallet</SelectItem>
              <SelectItem value="security">Security</SelectItem>
              <SelectItem value="special">Special</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-task">
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Tasks Management
          </CardTitle>
          <CardDescription>Manage platform tasks and challenges</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTasks && filteredTasks.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Trigger / Target</TableHead>
                  <TableHead>Rewards</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Completions</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1">{task.description}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline">{task.missionType || "one_time"}</Badge>
                        <span className="text-xs text-muted-foreground capitalize">{task.category}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div className="font-mono text-xs">{task.triggerKey || "manual"}</div>
                        <div className="text-muted-foreground">Target: {task.targetCount || 1}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>{task.xpReward} XP</div>
                        {parseFloat(task.xnrtReward) > 0 && (
                          <div className="text-muted-foreground">{parseFloat(task.xnrtReward).toLocaleString()} XNRT</div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={task.isActive ? "default" : "secondary"}
                        onClick={() => toggleMutation.mutate(task.id)}
                        data-testid={`button-toggle-${task.id}`}
                      >
                        {task.isActive ? (
                          <>
                            <ToggleRight className="h-4 w-4 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="h-4 w-4 mr-1" />
                            Inactive
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>{task.completionCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(task)}
                          data-testid={`button-edit-${task.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(task)}
                          data-testid={`button-delete-${task.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No tasks found</p>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editDialogOpen ? "Edit Task" : "Create New Task"}</DialogTitle>
            <DialogDescription>
              {editDialogOpen ? "Update task details" : "Add a daily mission, weekly quest, or one-time task"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Complete your first stake"
                data-testid="input-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Stake any amount to complete this task"
                rows={3}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="xpReward">XP Reward</Label>
                <Input
                  id="xpReward"
                  type="number"
                  value={formData.xpReward}
                  onChange={(e) => setFormData({ ...formData, xpReward: e.target.value })}
                  placeholder="100"
                  data-testid="input-xp-reward"
                />
              </div>
              <div>
                <Label htmlFor="xnrtReward">XNRT Reward</Label>
                <Input
                  id="xnrtReward"
                  type="number"
                  value={formData.xnrtReward}
                  onChange={(e) => setFormData({ ...formData, xnrtReward: e.target.value })}
                  placeholder="0"
                  data-testid="input-xnrt-reward"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="missionType">Mission Type</Label>
                <Select
                  value={formData.missionType}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    missionType: value,
                    category: value === "daily" || value === "weekly" ? value : formData.category,
                  })}
                >
                  <SelectTrigger id="missionType" data-testid="select-mission-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time task</SelectItem>
                    <SelectItem value="daily">Daily mission</SelectItem>
                    <SelectItem value="weekly">Weekly quest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger id="category" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="onboarding">Onboarding</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="staking">Staking</SelectItem>
                    <SelectItem value="mining">Mining</SelectItem>
                    <SelectItem value="referrals">Referrals</SelectItem>
                    <SelectItem value="wallet">Wallet</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="special">Special</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <Label htmlFor="triggerKey">Progress Trigger</Label>
                <Select value={formData.triggerKey} onValueChange={(value) => setFormData({ ...formData, triggerKey: value })}>
                  <SelectTrigger id="triggerKey" data-testid="select-trigger-key">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MISSION_TRIGGERS.map((trigger) => (
                      <SelectItem key={trigger.value} value={trigger.value}>{trigger.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="targetCount">Target Count</Label>
                <Input
                  id="targetCount"
                  type="number"
                  min="1"
                  value={formData.targetCount}
                  onChange={(e) => setFormData({ ...formData, targetCount: e.target.value })}
                  placeholder="1"
                  data-testid="input-target-count"
                />
              </div>
              <div>
                <Label htmlFor="sortOrder">Sort Order</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: e.target.value })}
                  placeholder="100"
                  data-testid="input-sort-order"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="requirements">Requirements (optional)</Label>
              <Input
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="e.g., Minimum stake amount: 1000 XNRT"
                data-testid="input-requirements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false);
              setEditDialogOpen(false);
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editDialogOpen && selectedTask) {
                  updateMutation.mutate({ id: selectedTask.id, data: formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.title || !formData.description}
              data-testid="button-submit"
            >
              {editDialogOpen ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedTask?.title}"?
              This will also remove all user progress for this task. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedTask && deleteMutation.mutate(selectedTask.id)}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
