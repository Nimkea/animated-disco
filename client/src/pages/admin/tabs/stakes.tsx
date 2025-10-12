import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2, Search, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { format } from "date-fns";

interface Stake {
  id: string;
  userId: string;
  tier: string;
  amount: string;
  dailyRate: string;
  duration: number;
  startDate: string;
  endDate: string;
  totalProfit: string;
  status: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

interface User {
  id: string;
  username: string;
  email: string;
}

export default function StakesTab() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedStake, setSelectedStake] = useState<Stake | null>(null);

  const [formData, setFormData] = useState({
    userId: "",
    tier: "royal_sapphire",
    amount: "",
    duration: "30",
  });

  const [editFormData, setEditFormData] = useState({
    status: "active",
    totalProfit: "",
  });

  const { data: stakes, isLoading } = useQuery<Stake[]>({
    queryKey: ["/api/admin/stakes"],
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/admin/stakes", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stakes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setCreateDialogOpen(false);
      setFormData({ userId: "", tier: "royal_sapphire", amount: "", duration: "30" });
      toast({ title: "Success", description: "Stake created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create stake", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editFormData }) => {
      return await apiRequest("PUT", `/api/admin/stakes/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stakes"] });
      setEditDialogOpen(false);
      setSelectedStake(null);
      toast({ title: "Success", description: "Stake updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update stake", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/stakes/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stakes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setDeleteDialogOpen(false);
      setSelectedStake(null);
      toast({ title: "Success", description: "Stake deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete stake", variant: "destructive" });
    },
  });

  const filteredStakes = stakes?.filter((stake) => {
    const matchesSearch =
      stake.user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stake.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stake.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || stake.status === statusFilter;
    const matchesTier = tierFilter === "all" || stake.tier === tierFilter;
    return matchesSearch && matchesStatus && matchesTier;
  });

  const getTierBadgeColor = (tier: string) => {
    switch (tier) {
      case "royal_sapphire": return "bg-blue-500/20 text-blue-500";
      case "legendary_emerald": return "bg-green-500/20 text-green-500";
      case "imperial_platinum": return "bg-purple-500/20 text-purple-500";
      case "mythic_diamond": return "bg-amber-500/20 text-amber-500";
      default: return "bg-gray-500/20 text-gray-500";
    }
  };

  const getTierName = (tier: string) => {
    return tier.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const handleEdit = (stake: Stake) => {
    setSelectedStake(stake);
    setEditFormData({
      status: stake.status,
      totalProfit: stake.totalProfit,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (stake: Stake) => {
    setSelectedStake(stake);
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
              placeholder="Search by user, email, or stake ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-stakes"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]" data-testid="select-status-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="withdrawn">Withdrawn</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-tier-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="royal_sapphire">Royal Sapphire</SelectItem>
              <SelectItem value="legendary_emerald">Legendary Emerald</SelectItem>
              <SelectItem value="imperial_platinum">Imperial Platinum</SelectItem>
              <SelectItem value="mythic_diamond">Mythic Diamond</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-create-stake">
          <Plus className="h-4 w-4 mr-2" />
          Create Stake
        </Button>
      </div>

      {/* Stakes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Stakes Management
          </CardTitle>
          <CardDescription>Manage platform staking positions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredStakes && filteredStakes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profit</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStakes.map((stake) => (
                  <TableRow key={stake.id} data-testid={`row-stake-${stake.id}`}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{stake.user.username}</div>
                        <div className="text-xs text-muted-foreground">{stake.user.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getTierBadgeColor(stake.tier)}>
                        {getTierName(stake.tier)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{parseFloat(stake.amount).toLocaleString()} XNRT</TableCell>
                    <TableCell>{stake.duration} days</TableCell>
                    <TableCell>
                      <Badge variant={stake.status === "active" ? "default" : "secondary"}>
                        {stake.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{parseFloat(stake.totalProfit).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{format(new Date(stake.endDate), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(stake)}
                          data-testid={`button-edit-${stake.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(stake)}
                          data-testid={`button-delete-${stake.id}`}
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
            <p className="text-center py-8 text-muted-foreground">No stakes found</p>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Stake</DialogTitle>
            <DialogDescription>Create a staking position for a user</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="user">User</Label>
              <Select value={formData.userId} onValueChange={(value) => setFormData({ ...formData, userId: value })}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="Select user" />
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tier">Tier</Label>
              <Select value={formData.tier} onValueChange={(value) => setFormData({ ...formData, tier: value })}>
                <SelectTrigger data-testid="select-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="royal_sapphire">Royal Sapphire (1.1x daily)</SelectItem>
                  <SelectItem value="legendary_emerald">Legendary Emerald (1.4x daily)</SelectItem>
                  <SelectItem value="imperial_platinum">Imperial Platinum (1.5x daily)</SelectItem>
                  <SelectItem value="mythic_diamond">Mythic Diamond (2.0x daily)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount (XNRT)</Label>
              <Input
                id="amount"
                type="number"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="10000"
                data-testid="input-amount"
              />
            </div>
            <div>
              <Label htmlFor="duration">Duration (days)</Label>
              <Select value={formData.duration} onValueChange={(value) => setFormData({ ...formData, duration: value })}>
                <SelectTrigger data-testid="select-duration">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="45">45 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="180">180 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={createMutation.isPending || !formData.userId || !formData.amount}
              data-testid="button-submit-create"
            >
              Create Stake
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Stake</DialogTitle>
            <DialogDescription>Update stake status and profit</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={editFormData.status} onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}>
                <SelectTrigger data-testid="select-edit-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="totalProfit">Total Profit</Label>
              <Input
                id="totalProfit"
                type="number"
                value={editFormData.totalProfit}
                onChange={(e) => setEditFormData({ ...editFormData, totalProfit: e.target.value })}
                placeholder="0"
                data-testid="input-edit-profit"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedStake && updateMutation.mutate({ id: selectedStake.id, data: editFormData })}
              disabled={updateMutation.isPending}
              data-testid="button-submit-edit"
            >
              Update Stake
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Stake</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this stake for {selectedStake?.user.username}?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedStake && deleteMutation.mutate(selectedStake.id)}
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
