import { UserPersonalizationEditorShell } from "@/PixelCraft/reference-nextjs-app/components/UserPersonalizationEditorShell";

export default function PersonalizePage({
  params,
}: {
  params: { productId: string };
}) {
  // In production:
  // - fetch product -> mapped published templateVersionId
  // - fetch published TemplateDocument
  return (
    <div className="min-h-screen p-4">
      <UserPersonalizationEditorShell productId={params.productId} />
    </div>
  );
}

