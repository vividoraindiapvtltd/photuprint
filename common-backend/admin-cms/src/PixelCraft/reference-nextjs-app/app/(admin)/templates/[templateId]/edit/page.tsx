import { AdminTemplateEditorShell } from "@/PixelCraft/reference-nextjs-app/components/AdminTemplateEditorShell";

export default function AdminTemplateEditPage({
  params,
}: {
  params: { templateId: string };
}) {
  // In production:
  // - fetch template draft or create draft from published
  // - pass TemplateDocument + active areaId
  return (
    <div className="h-[calc(100vh-0px)]">
      <AdminTemplateEditorShell templateId={params.templateId} />
    </div>
  );
}

