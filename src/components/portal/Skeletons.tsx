export function SkeletonBlock({
  height,
  width,
  radius = 14,
}: {
  height: number;
  width?: string;
  radius?: number;
}) {
  return (
    <span
      className="pt-skeleton"
      style={{ height, width: width ?? "100%", borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your dashboard">
      <div className="pt-skeleton-stack">
        <SkeletonBlock height={132} radius={20} />
        <div className="pt-skeleton-row">
          <SkeletonBlock height={96} />
          <SkeletonBlock height={96} />
          <SkeletonBlock height={96} />
          <SkeletonBlock height={96} />
        </div>
        <div className="pt-skeleton-cols">
          <div className="pt-skeleton-stack">
            <SkeletonBlock height={280} radius={20} />
            <SkeletonBlock height={140} radius={20} />
          </div>
          <div className="pt-skeleton-stack">
            <SkeletonBlock height={180} radius={20} />
            <SkeletonBlock height={200} radius={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="pt-skeleton-stack">
        <SkeletonBlock height={72} width="min(430px, 80%)" />
        <SkeletonBlock height={110} radius={20} />
        <SkeletonBlock height={110} radius={20} />
        <SkeletonBlock height={110} radius={20} />
      </div>
    </div>
  );
}

export function LessonSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading lesson">
      <div className="pt-skeleton-cols pt-skeleton-cols-wide">
        <div className="pt-skeleton-stack">
          <SkeletonBlock height={20} width="40%" radius={8} />
          <SkeletonBlock height={44} width="70%" radius={10} />
          <SkeletonBlock height={320} radius={20} />
          <SkeletonBlock height={16} radius={8} />
          <SkeletonBlock height={16} width="92%" radius={8} />
          <SkeletonBlock height={16} width="85%" radius={8} />
        </div>
        <div className="pt-skeleton-stack">
          <SkeletonBlock height={380} radius={20} />
        </div>
      </div>
    </div>
  );
}
