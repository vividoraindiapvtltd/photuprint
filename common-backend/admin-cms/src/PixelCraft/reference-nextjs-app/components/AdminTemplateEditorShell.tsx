"use client";

import { useMemo, useState } from "react";

/**
 * Minimal admin editor shell:
 * - Loads a draft TemplateDocument (placeholder)
 * - Shows area tabs
 * - Hosts Fabric editor component (not fully implemented here)
 *
 * Production code should use:
 * - PixelCraft editor libs: `admin-cms/src/PixelCraft/editor/*`
 * - Autosave + versioning API
 */
export function AdminTemplateEditorShell({ templateId }: { templateId: string }) {
  const [activeAreaId, setActiveAreaId] = useState("front");

  const areaIds = useMemo(() => ["front", "back"], []);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-sm text-gray-500">Template</div>
          <div className="font-semibold">{templateId}</div>
        </div>

        <div className="flex items-center gap-2">
          {areaIds.map((id) => (
            <button
              key={id}
              onClick={() => setActiveAreaId(id)}
              className={`rounded px-3 py-1 text-sm ${
                activeAreaId === id ? "bg-black text-white" : "bg-gray-100"
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button className="rounded bg-gray-100 px-3 py-1 text-sm">
            Save draft
          </button>
          <button className="rounded bg-black px-3 py-1 text-sm text-white">
            Publish
          </button>
        </div>
      </div>

      <div className="flex flex-1">
        <aside className="w-72 border-r p-3 text-sm text-gray-700">
          <div className="font-medium">Layers</div>
          <div className="mt-2 text-xs text-gray-500">
            Implement with `LayerPanel` + Fabric object metadata.
          </div>

          <div className="mt-4 font-medium">Editable fields</div>
          <div className="mt-2 text-xs text-gray-500">
            Implement variable binding + constraints editor.
          </div>
        </aside>

        <main className="flex-1 p-4">
          <div className="mb-3 text-sm text-gray-600">
            Active area: <span className="font-medium">{activeAreaId}</span>
          </div>

          <div className="h-[calc(100%-24px)] rounded border bg-white">
            <div className="p-4 text-sm text-gray-500">
              Fabric editor goes here (client component). Use PixelCraft `editor/lib/*`
              for init + serialize/deserialize.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

