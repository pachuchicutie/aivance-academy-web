import { Download, ExternalLink, FolderOpen } from "lucide-react";
import { getAllResources, getPortalContext } from "@/lib/portal/queries";
import { EmptyState, PageHeader } from "@/components/portal/ui";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resources | AIvanza Academy",
};

export default async function ResourcesPage() {
  const { supabase } = await getPortalContext();
  const resources = await getAllResources(supabase);

  const byCourse = new Map<string, typeof resources>();
  for (const resource of resources) {
    const list = byCourse.get(resource.courseTitle) ?? [];
    list.push(resource);
    byCourse.set(resource.courseTitle, list);
  }

  return (
    <>
      <PageHeader
        eyebrow="Library"
        title="Resources"
        description="Templates, files, and links shared inside your enrolled courses."
      />

      {resources.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Nothing here yet"
          message="No learning resources are currently available."
        />
      ) : (
        Array.from(byCourse.entries()).map(([courseTitle, items]) => (
          <section key={courseTitle} className="pt-panel">
            <h2 className="pt-panel-title">{courseTitle}</h2>
            <div className="pt-panel-body">
              <ul className="pt-resource-list">
                {items.map((resource, index) => (
                  <li key={`${resource.url}-${index}`}>
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pt-resource-link"
                      {...(resource.kind === "attachment"
                        ? { download: true }
                        : {})}
                    >
                      {resource.kind === "attachment" ? (
                        <Download size={16} aria-hidden="true" />
                      ) : (
                        <ExternalLink size={16} aria-hidden="true" />
                      )}
                      <span className="pt-resource-copy">
                        <strong>{resource.title}</strong>
                        <span>
                          {resource.moduleTitle}
                          {resource.lessonTitle
                            ? ` · ${resource.lessonTitle}`
                            : ""}
                        </span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))
      )}
    </>
  );
}
