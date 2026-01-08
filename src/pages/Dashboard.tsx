import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  CheckSquare,
  MessageSquare,
  TrendingUp,
  Clock,
  AlertTriangle,
  ChevronRight,
  LogOut,
} from "lucide-react";
import {
  PremiumCard,
  PremiumCardHeader,
  PremiumCardTitle,
  PremiumCardContent,
} from "@/components/ui/premium-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { PriorityBadge } from "@/components/ui/priority-badge";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

import { useStoreInboxSummary } from "@/hooks/useStoreInboxSummary";
import { useStoreTaskSummary } from "@/hooks/useStoreTaskSummary";
import { useStorePerformanceSummary } from "@/hooks/useStorePerformanceSummary";

const Dashboard: React.FC = () => {
  const { profile, store } = useAuth();
  const navigate = useNavigate();

  /* ======================
     MESSAGES
  ====================== */
  const {
    total: messagesTotal,
    read: messagesRead,
    unread: unreadMessages,
  } = useStoreInboxSummary(store?.id);

  /* ======================
     TASKS
  ====================== */
  const {
    total: tasksTotal,
    completedCount: tasksCompleted,
    pendingCount: pendingTasks,
    overdue: overdueTasks,
  } = useStoreTaskSummary(store?.id);

  const {
  achieved: salesAchieved,
  target: salesTarget,
  percent: salesPercent,
} = useStorePerformanceSummary(store?.code);


  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="pt-2 animate-fade-in flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Hello, {profile?.name || "Manager"}! 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            {store?.name || "Your Store"}, {store?.city || ""}
          </p>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="flex items-center gap-2 text-muted-foreground hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>

      {/* Summary */}
      <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl border border-primary/20 animate-slide-up">
        <p className="text-sm text-foreground">
          You have{" "}
          <span className="font-bold text-primary">
            {pendingTasks} pending tasks
          </span>{" "}
          and{" "}
          <span className="font-bold text-accent">
            {unreadMessages} unread messages
          </span>{" "}
          today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 animate-slide-up">
        <Link to="/tasks">
          <PremiumCard hover className="h-full">
            <PremiumCardHeader>
              <CheckSquare className="h-5 w-5 text-primary" />
            </PremiumCardHeader>
            <PremiumCardContent>
              <p className="text-2xl font-bold text-foreground">
                {tasksCompleted}/{tasksTotal}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tasks completed
              </p>
            </PremiumCardContent>
          </PremiumCard>
        </Link>

        <Link to="/communications">
          <PremiumCard hover className="h-full">
            <PremiumCardHeader>
              <MessageSquare className="h-5 w-5 text-accent" />
            </PremiumCardHeader>
            <PremiumCardContent>
              <p className="text-2xl font-bold text-foreground">
                {messagesRead}/{messagesTotal}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Messages read
              </p>
            </PremiumCardContent>
          </PremiumCard>
        </Link>
      </div>

      {/* Sales */}
      <Link to="/performance">
        <PremiumCard hover className="animate-slide-up">
          <PremiumCardHeader>
            <PremiumCardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Today&apos;s Sales
            </PremiumCardTitle>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </PremiumCardHeader>
          <PremiumCardContent>
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Target vs Achieved
                </p>
                <p className="text-xl font-bold text-foreground mt-1">
                  ₹{Math.round(salesAchieved).toLocaleString("en-IN")}{" "}
                  <span className="text-muted-foreground font-normal">
                    / ₹{Math.round(salesTarget).toLocaleString("en-IN")}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">
  Based on latest sales upload
</p>
              </div>

              <ProgressRing
                progress={salesPercent}
                variant={
                  salesPercent >= 80
                    ? "success"
                    : salesPercent >= 50
                    ? "accent"
                    : "warning"
                }
              />
            </div>
          </PremiumCardContent>
        </PremiumCard>
      </Link>

      {/* Priority Tasks */}
      <div className="animate-slide-up">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">
            Priority Tasks
          </h2>
          <Link to="/tasks" className="text-sm text-primary font-medium">
            View all
          </Link>
        </div>

        {overdueTasks.length > 0 ? (
          <>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                Overdue
              </span>
            </div>

            <div className="space-y-2">
              {overdueTasks.slice(0, 3).map((t) => (
                <Link key={t.task_id} to="/tasks">
                  <PremiumCard hover variant="warning" className="!p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {t.tasks.title}
                        </p>
                        <p className="text-xs text-destructive mt-0.5">
                          Overdue
                        </p>
                      </div>
                      <PriorityBadge priority={t.tasks.priority} />
                    </div>
                  </PremiumCard>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No overdue tasks 🎉
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;