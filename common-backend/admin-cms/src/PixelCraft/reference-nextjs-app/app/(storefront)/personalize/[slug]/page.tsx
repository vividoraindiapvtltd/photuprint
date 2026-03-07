import { UserPersonalizationEditorShell } from "@/PixelCraft/reference-nextjs-app/components/UserPersonalizationEditorShell";

/**
 * Personalize page: /personalize/[slug]
 * Use product slug in URL (same as /product/[slug]).
 */
export default function PersonalizePage({
  params,
}: {
  params: { slug: string };
}) {
  return (
    <div className="min-h-screen p-4">
      <UserPersonalizationEditorShell slug={params.slug} />
    </div>
  );
}
