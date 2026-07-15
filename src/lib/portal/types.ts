export type Tier = "basic" | "plus" | "pro";
export type ProfileStatus = "active" | "suspended" | "deactivated";

export type PortalProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: "student" | "admin";
  tier: Tier | null;
  status: ProfileStatus;
  batch: string | null;
  created_at?: string | null;
};

export type ResourceLink = {
  title: string;
  url: string;
};

export type ResourceAttachment = {
  title: string;
  url: string;
  path?: string;
  mime_type?: string;
  size?: number;
};

export type PortalCourse = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
};

export type PortalLessonSummary = {
  id: string;
  title: string;
  description: string | null;
  lesson_number: number;
  sort_order: number | null;
  completed: boolean;
};

export type PortalModule = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  module_number: number;
  sort_order: number | null;
  required_tier: Tier;
  lessons: PortalLessonSummary[];
};

/**
 * Canonical COURSE-WIDE progress (module-weighted).
 * overallCourseProgressPercentage = average of each published module's progress.
 * Empty published modules contribute 0% and remain in the denominator.
 */
export type CourseProgress = {
  courseId?: string;
  /** Published modules in the student-visible course structure */
  totalCourseModules: number;
  /** Modules with ≥1 lesson and every lesson completed */
  completedCourseModules: number;
  /** Modules with at least one completed lesson */
  startedCourseModules: number;
  /** Published lessons across every published module (supporting context) */
  totalCourseLessons: number;
  /** Student completions within those lessons */
  completedCourseLessons: number;
  /**
   * Module-weighted overall % for display (0–100, nearest integer).
   * Equal weight per published module — NOT lessons/totalLessons.
   */
  overallCourseProgressPercentage: number;
  /**
   * Unrounded module-weighted % (0–100) for bars / multi-course aggregates.
   */
  overallCourseProgressExact: number;
  /**
   * @deprecated Prefer overallCourseProgressPercentage — kept as alias.
   */
  courseProgressPercentage: number;
  nextIncompleteLessonId: string | null;
  nextIncompleteLessonTitle: string | null;
  lastActivityAt: string | null;
  /** True when the course has zero published modules */
  contentPending: boolean;
};

/** Module-local progress for accordion / module headers only. */
export type ModuleProgress = {
  moduleId: string;
  totalModuleLessons: number;
  completedModuleLessons: number;
  moduleProgressPercentage: number;
};

export type EnrolledCourse = {
  enrollmentId: string;
  enrollmentTier: Tier;
  startedAt: string;
  course: PortalCourse;
  coverImage: string | null;
  progress: CourseProgress;
};

/** Server-resolved catalog access state (never trust client-only checks). */
export type CourseAccessState =
  | "enrolled_accessible"
  | "eligible_not_enrolled"
  | "locked_by_tier"
  | "unavailable";

export type CourseTierLabel = {
  id: string;
  code: string;
  label: string;
};

/**
 * Unified My Courses library item — enrolled, eligible, or locked for discovery.
 * Progress is only present for enrolled_accessible courses.
 */
export type CourseLibraryItem = {
  course: PortalCourse;
  coverImage: string | null;
  accessState: CourseAccessState;
  tierAccessMode: "all_tiers" | "selected_tiers";
  eligibleTiers: CourseTierLabel[];
  requiredTierSummary: string;
  enrollmentId: string | null;
  enrollmentTier: Tier | null;
  progress: CourseProgress | null;
};

export type PortalLesson = {
  id: string;
  module_id: string;
  title: string;
  description: string | null;
  content: string | null;
  image_url: string | null;
  video_url: string | null;
  resource_links: ResourceLink[];
  attachments: ResourceAttachment[];
  lesson_number: number;
  sort_order: number | null;
};

export type AnnouncementType = "general" | "update" | "event" | "reminder";

export type PortalAnnouncement = {
  id: string;
  title: string;
  body: string | null;
  type: AnnouncementType;
  published_at: string;
  created_at: string;
  read: boolean;
};

export type PortalCommunity = {
  id: string;
  name: string;
  description: string | null;
  platform: string;
  external_url: string | null;
  mentor_name: string | null;
};

export type PortalLiveSession = {
  id: string;
  title: string;
  description: string | null;
  mentor_name: string | null;
  session_type: "live_class" | "qna" | "workshop" | "orientation" | string;
  starts_at: string;
  duration_minutes: number;
  meeting_url: string | null;
  status: string;
  course_id?: string | null;
};

export type CourseResource = {
  title: string;
  url: string;
  kind: "link" | "attachment" | "file";
  courseTitle: string;
  courseSlug: string;
  moduleTitle: string | null;
  lessonTitle: string | null;
  mimeType?: string | null;
};
