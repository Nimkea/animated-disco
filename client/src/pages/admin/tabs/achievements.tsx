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
import { Plus, Pencil, Trash2, Search, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requirement: number;
  xpReward: number;
  unlockCount: number;
}

export default function AchievementsTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    icon: "🏆",
    category: "earnings",
    requirement: "",
    xpReward: "",
  });

  const { data: achievements, isLoading } = useQuery<Achievement[]>({
    queryKey: ["/api/admin/achievements"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/achievements", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/achievements"] });
      setCreateDialogOpen(false);
      setFormData({
        title: "",
        description: "",
        icon: "🏆",
        category: "earnings",
        requirement: "",
        xpReward: "",
      });
      toast({ title: "Success", description: "Achievement created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create achievement", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return await apiRequest("PUT", `/api/admin/achievements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/achievements"] });
      setEditDialogOpen(false);
      setSelectedAchievement(null);
      toast({ title: "Success", description: "Achievement updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update achievement", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/achievements/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/achievements"] });
      setDeleteDialogOpen(false);
      setSelectedAchievement(null);
      toast({ title: "Success", description: "Achievement deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete achievement", variant: "destructive" });
    },
  });

  const filteredAchievements = achievements?.filter((achievement) => {
    const matchesSearch =
      achievement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      achievement.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === "all" || achievement.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setFormData({
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      category: achievement.category,
      requirement: achievement.requirement.toString(),
      xpReward: achievement.xpReward.toString(),
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setDeleteDialogOpen(true);
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "earnings": return "bg-green-500/20 text-green-500";
      case "referrals": return "bg-blue-500/20 text-blue-500";
      case "streaks": return "bg-purple-500/20 text-purple-500";
      case "mining": return "bg-amber-500/20 text-amber-500";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search achievements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-achievements"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-category-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="earnings">Earnings</SelectItem>
              <SelectItem value="referrals">Referrals</SelectItem>
              <SelectItem value="streaks">Streaks</SelectItem>
              <SelectItem value="mining">Mining</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-achievement">
          <Plus className="h-4 w-4 mr-2" />
          Create Achievement
        </Button>
      </div>

      {/* Achievements Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Achievements Management
          </CardTitle>
          <CardDescription>Manage platform achievements and milestones</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredAchievements && filteredAchievements.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Achievement</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Requirement</TableHead>
                  <TableHead>XP Reward</TableHead>
                  <TableHead>Unlocked By</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAchievements.map((achievement) => (
                  <TableRow key={achievement.id} data-testid={`row-achievement-${achievement.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{achievement.icon}</span>
                        <div>
                          <div className="font-medium">{achievement.title}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{achievement.description}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCategoryBadgeColor(achievement.category)}>
                        {achievement.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{achievement.requirement.toLocaleString()}</TableCell>
                    <TableCell>{achievement.xpReward} XP</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{achievement.unlockCount} users</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(achievement)}
                          data-testid={`button-edit-${achievement.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(achievement)}
                          data-testid={`button-delete-${achievement.id}`}
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
            <p className="text-center py-8 text-muted-foreground">No achievements found</p>
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
            <DialogTitle>{editDialogOpen ? "Edit Achievement" : "Create New Achievement"}</DialogTitle>
            <DialogDescription>
              {editDialogOpen ? "Update achievement details" : "Add a new achievement to the platform"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="First Earnings"
                data-testid="input-title"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Earn your first 1000 XNRT"
                rows={3}
                data-testid="input-description"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="icon">Icon (Emoji)</Label>
                <Input
                  id="icon"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="🏆"
                  maxLength={2}
                  data-testid="input-icon"
                />
              </div>
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="earnings">Earnings</SelectItem>
                    <SelectItem value="referrals">Referrals</SelectItem>
                    <SelectItem value="streaks">Streaks</SelectItem>
                    <SelectItem value="mining">Mining</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="requirement">Requirement</Label>
                <Input
                  id="requirement"
                  type="number"
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  placeholder="1000"
                  data-testid="input-requirement"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {formData.category === "earnings" && "Total XNRT earned"}
                  {formData.category === "referrals" && "Number of referrals"}
                  {formData.category === "streaks" && "Login streak days"}
                  {formData.category === "mining" && "Mining sessions completed"}
                </p>
              </div>
              <div>
                <Label htmlFor="xpReward">XP Reward</Label>
                <Input
                  id="xpReward"
                  type="number"
                  value={formData.xpReward}
                  onChange={(e) => setFormData({ ...formData, xpReward: e.target.value })}
                  placeholder="500"
                  data-testid="input-xp-reward"
                />
              </div>
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
                if (editDialogOpen && selectedAchievement) {
                  updateMutation.mutate({ id: selectedAchievement.id, data: formData });
                } else {
                  createMutation.mutate(formData);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending || !formData.title || !formData.description}
              data-testid="button-submit"
            >
              {editDialogOpen ? "Update Achievement" : "Create Achievement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Achievement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAchievement?.title}"?
              This will also remove all user unlocks for this achievement. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAchievement && deleteMutation.mutate(selectedAchievement.id)}
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
