import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertStakingTierSchema, type InsertStakingTier, type StakingTier } from "@shared/schema";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  apy: z.coerce.number().positive("APY must be positive"),
  duration: z.coerce.number().int().positive("Duration must be a positive integer"),
  minAmount: z.coerce.number().positive("Minimum amount must be positive"),
  maxAmount: z.union([
    z.string().length(0).transform(() => undefined),
    z.coerce.number().positive("Maximum amount must be positive")
  ]).optional(),
  isActive: z.boolean().default(true),
});

export default function StakingTiersTab() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTier, setSelectedTier] = useState<StakingTier | null>(null);

  const createForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      apy: 0,
      duration: 0,
      minAmount: 0,
      maxAmount: undefined,
      isActive: true,
    },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      apy: 0,
      duration: 0,
      minAmount: 0,
      maxAmount: undefined,
      isActive: true,
    },
  });

  const { data: tiers, isLoading } = useQuery<StakingTier[]>({
    queryKey: ["/api/admin/staking-tiers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const payload = {
        ...data,
        maxAmount: data.maxAmount ?? null,
      };
      return await apiRequest("POST", "/api/admin/staking-tiers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staking-tiers"] });
      setCreateDialogOpen(false);
      createForm.reset();
      toast({ title: "Success", description: "Staking tier created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to create staking tier",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof formSchema> }) => {
      const payload = {
        ...data,
        maxAmount: data.maxAmount ?? null,
      };
      return await apiRequest("PUT", `/api/admin/staking-tiers/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staking-tiers"] });
      setEditDialogOpen(false);
      setSelectedTier(null);
      editForm.reset();
      toast({ title: "Success", description: "Staking tier updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to update staking tier",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/admin/staking-tiers/${id}/toggle`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staking-tiers"] });
      toast({ title: "Success", description: "Tier status toggled successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to toggle tier status", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/admin/staking-tiers/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/staking-tiers"] });
      setDeleteDialogOpen(false);
      setSelectedTier(null);
      toast({ title: "Success", description: "Staking tier deleted successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete staking tier", variant: "destructive" });
    },
  });

  const handleCreate = (data: z.infer<typeof formSchema>) => {
    createMutation.mutate(data);
  };

  const handleEdit = (tier: StakingTier) => {
    setSelectedTier(tier);
    editForm.reset({
      name: tier.name,
      description: tier.description || "",
      apy: typeof tier.apy === 'string' ? parseFloat(tier.apy) : tier.apy,
      duration: tier.duration,
      minAmount: typeof tier.minAmount === 'string' ? parseFloat(tier.minAmount) : tier.minAmount,
      maxAmount: tier.maxAmount ? (typeof tier.maxAmount === 'string' ? parseFloat(tier.maxAmount) : tier.maxAmount) : undefined,
      isActive: tier.isActive,
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = (data: z.infer<typeof formSchema>) => {
    if (selectedTier) {
      updateMutation.mutate({ id: selectedTier.id, data });
    }
  };

  const handleDeleteClick = (tier: StakingTier) => {
    setSelectedTier(tier);
    setDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (selectedTier) {
      deleteMutation.mutate(selectedTier.id);
    }
  };

  const handleToggle = (id: string) => {
    toggleMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-black dark:text-white">
            Staking Tiers
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage staking tier plans and configurations
          </p>
        </div>
        <Button
          onClick={() => {
            createForm.reset();
            setCreateDialogOpen(true);
          }}
          className="bg-amber-500 hover:bg-amber-600 text-black"
          data-testid="button-create-tier"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Tier
        </Button>
      </div>

      <Card className="bg-white/50 dark:bg-black/50 border-amber-500/20">
        <CardHeader>
          <CardTitle className="text-black dark:text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-amber-500" />
            All Staking Tiers
          </CardTitle>
          <CardDescription>
            {tiers?.length || 0} tier{tiers?.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading tiers...</div>
          ) : !tiers || tiers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staking tiers created yet
            </div>
          ) : (
            <div className="rounded-md border border-amber-500/20">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber-500/20">
                    <TableHead className="text-black dark:text-white">Name</TableHead>
                    <TableHead className="text-black dark:text-white">APY</TableHead>
                    <TableHead className="text-black dark:text-white">Duration</TableHead>
                    <TableHead className="text-black dark:text-white">Min Amount</TableHead>
                    <TableHead className="text-black dark:text-white">Max Amount</TableHead>
                    <TableHead className="text-black dark:text-white">Status</TableHead>
                    <TableHead className="text-black dark:text-white text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tiers.map((tier) => (
                    <TableRow
                      key={tier.id}
                      className="border-amber-500/20"
                      data-testid={`row-tier-${tier.id}`}
                    >
                      <TableCell className="font-medium text-black dark:text-white">
                        <div>
                          <div data-testid={`text-tier-name-${tier.id}`}>{tier.name}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {tier.description}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-amber-500 text-amber-500"
                          data-testid={`text-tier-apy-${tier.id}`}
                        >
                          {tier.apy}% APY
                        </Badge>
                      </TableCell>
                      <TableCell className="text-black dark:text-white" data-testid={`text-tier-duration-${tier.id}`}>
                        {tier.duration} days
                      </TableCell>
                      <TableCell className="text-black dark:text-white" data-testid={`text-tier-min-${tier.id}`}>
                        {parseFloat(tier.minAmount.toString()).toLocaleString()} XNRT
                      </TableCell>
                      <TableCell className="text-black dark:text-white" data-testid={`text-tier-max-${tier.id}`}>
                        {tier.maxAmount
                          ? `${parseFloat(tier.maxAmount.toString()).toLocaleString()} XNRT`
                          : "No limit"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tier.isActive ? "default" : "secondary"}
                          className={
                            tier.isActive
                              ? "bg-green-500/20 text-green-500 border-green-500"
                              : "bg-gray-500/20 text-gray-500 border-gray-500"
                          }
                          data-testid={`text-tier-status-${tier.id}`}
                        >
                          {tier.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(tier.id)}
                            className="h-8 w-8 p-0 text-amber-500 hover:text-amber-600 hover:bg-amber-500/10"
                            data-testid={`button-toggle-tier-${tier.id}`}
                          >
                            {tier.isActive ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tier)}
                            className="h-8 w-8 p-0 text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                            data-testid={`button-edit-tier-${tier.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteClick(tier)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            data-testid={`button-delete-tier-${tier.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-950 border-amber-500/20">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">
              Create Staking Tier
            </DialogTitle>
            <DialogDescription>
              Configure a new staking tier plan for users
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white">Tier Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Royal Sapphire"
                        {...field}
                        className="bg-white dark:bg-black border-amber-500/20"
                        data-testid="input-tier-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Brief description of the tier"
                        {...field}
                        value={field.value || ""}
                        className="bg-white dark:bg-black border-amber-500/20"
                        data-testid="input-tier-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="apy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">APY (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="e.g., 402"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-tier-apy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Duration (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 15"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-tier-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="minAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Min Amount (XNRT)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="e.g., 100"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-tier-min-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="maxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Max Amount (XNRT)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Optional (no limit)"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-tier-max-amount"
                        />
                      </FormControl>
                      <FormDescription>Leave blank for no limit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                  className="border-amber-500/20"
                  data-testid="button-cancel-create"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                  data-testid="button-confirm-create"
                >
                  {createMutation.isPending ? "Creating..." : "Create Tier"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-white dark:bg-gray-950 border-amber-500/20">
          <DialogHeader>
            <DialogTitle className="text-black dark:text-white">
              Edit Staking Tier
            </DialogTitle>
            <DialogDescription>
              Update staking tier configuration
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white">Tier Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        className="bg-white dark:bg-black border-amber-500/20"
                        data-testid="input-edit-tier-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-black dark:text-white">Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value || ""}
                        className="bg-white dark:bg-black border-amber-500/20"
                        data-testid="input-edit-tier-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="apy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">APY (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-edit-tier-apy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Duration (days)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-edit-tier-duration"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="minAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Min Amount (XNRT)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-edit-tier-min-amount"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="maxAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-black dark:text-white">Max Amount (XNRT)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          {...field}
                          className="bg-white dark:bg-black border-amber-500/20"
                          data-testid="input-edit-tier-max-amount"
                        />
                      </FormControl>
                      <FormDescription>Leave blank for no limit</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  className="border-amber-500/20"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-amber-500 hover:bg-amber-600 text-black"
                  data-testid="button-confirm-edit"
                >
                  {updateMutation.isPending ? "Updating..." : "Update Tier"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-gray-950 border-amber-500/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Delete Staking Tier
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-amber-500">{selectedTier?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="border-amber-500/20"
              data-testid="button-cancel-delete"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
