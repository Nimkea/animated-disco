import type { Express } from "express";
import type { RouteContext } from "../../routes";
import { recordAdminAuditLog } from "../../services/audit.service";
import {
  createLessonFromPayload,
  deleteLessonQuestion,
  getAdminLessons,
  updateLessonFromPayload,
  upsertLessonQuestion,
} from "../../services/learn-earn.service";

export function registerAdminLearnEarnRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth, requireAdmin, validateCSRF } = ctx;

  app.get("/api/admin/learn/lessons", requireAuth, requireAdmin, async (_req, res) => {
    try {
      const lessons = await getAdminLessons();
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching admin lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.post("/api/admin/learn/lessons", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const lesson = await createLessonFromPayload(req.body || {});
      await recordAdminAuditLog({
        adminUserId: req.authUser!.id,
        entityType: "lesson",
        entityId: lesson.id,
        action: "lesson_created",
        summary: `Created Learn & Earn lesson: ${lesson.title}`,
        req,
      });
      res.status(201).json(lesson);
    } catch (error: any) {
      console.error("Error creating lesson:", error);
      res.status(400).json({ message: error?.message || "Failed to create lesson" });
    }
  });

  app.patch("/api/admin/learn/lessons/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const lesson = await updateLessonFromPayload(req.params.id, req.body || {});
      await recordAdminAuditLog({
        adminUserId: req.authUser!.id,
        entityType: "lesson",
        entityId: lesson.id,
        action: "lesson_updated",
        summary: `Updated Learn & Earn lesson: ${lesson.title}`,
        metadata: { fields: Object.keys(req.body || {}) },
        req,
      });
      res.json(lesson);
    } catch (error: any) {
      console.error("Error updating lesson:", error);
      res.status(400).json({ message: error?.message || "Failed to update lesson" });
    }
  });

  app.post("/api/admin/learn/lessons/:id/questions", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const question = await upsertLessonQuestion(req.params.id, req.body || {});
      await recordAdminAuditLog({
        adminUserId: req.authUser!.id,
        entityType: "lesson_question",
        entityId: question.id,
        action: "lesson_question_created",
        summary: "Created Learn & Earn quiz question",
        metadata: { lessonId: req.params.id },
        req,
      });
      res.status(201).json(question);
    } catch (error: any) {
      console.error("Error creating lesson question:", error);
      res.status(400).json({ message: error?.message || "Failed to create lesson question" });
    }
  });

  app.patch("/api/admin/learn/questions/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const question = await upsertLessonQuestion("", req.body || {}, req.params.id);
      await recordAdminAuditLog({
        adminUserId: req.authUser!.id,
        entityType: "lesson_question",
        entityId: question.id,
        action: "lesson_question_updated",
        summary: "Updated Learn & Earn quiz question",
        req,
      });
      res.json(question);
    } catch (error: any) {
      console.error("Error updating lesson question:", error);
      res.status(400).json({ message: error?.message || "Failed to update lesson question" });
    }
  });

  app.delete("/api/admin/learn/questions/:id", requireAuth, requireAdmin, validateCSRF, async (req, res) => {
    try {
      const result = await deleteLessonQuestion(req.params.id);
      await recordAdminAuditLog({
        adminUserId: req.authUser!.id,
        entityType: "lesson_question",
        entityId: req.params.id,
        action: "lesson_question_deleted",
        summary: "Deleted Learn & Earn quiz question",
        req,
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error deleting lesson question:", error);
      res.status(400).json({ message: error?.message || "Failed to delete lesson question" });
    }
  });
}
