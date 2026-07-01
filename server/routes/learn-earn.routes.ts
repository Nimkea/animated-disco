import type { Express } from "express";
import type { RouteContext } from "../routes";
import { getLessonForUser, getLessonsForUser, submitLessonQuiz } from "../services/learn-earn.service";

export function registerLearnEarnRoutes(app: Express, ctx: RouteContext) {
  const { requireAuth, validateCSRF } = ctx;

  app.get("/api/learn/lessons", requireAuth, async (req, res) => {
    try {
      const lessons = await getLessonsForUser(req.authUser!.id);
      res.json(lessons);
    } catch (error) {
      console.error("Error fetching lessons:", error);
      res.status(500).json({ message: "Failed to fetch lessons" });
    }
  });

  app.get("/api/learn/lessons/:slug", requireAuth, async (req, res) => {
    try {
      const lesson = await getLessonForUser(req.authUser!.id, req.params.slug);
      if (!lesson) return res.status(404).json({ message: "Lesson not found" });
      res.json(lesson);
    } catch (error) {
      console.error("Error fetching lesson:", error);
      res.status(500).json({ message: "Failed to fetch lesson" });
    }
  });

  app.post("/api/learn/lessons/:slug/submit", requireAuth, validateCSRF, async (req, res) => {
    try {
      const result = await submitLessonQuiz(req.authUser!.id, req.params.slug, req.body?.answers || {});
      if (!result.ok) return res.status(result.status).json({ message: result.message });
      res.json(result);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      res.status(500).json({ message: "Failed to submit quiz" });
    }
  });
}
