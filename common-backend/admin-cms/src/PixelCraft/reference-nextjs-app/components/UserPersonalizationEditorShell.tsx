"use client";

import { useMemo, useState } from "react";

/**
 * Minimal user editor shell:
 * - Loads a published TemplateDocument (placeholder)
 * - Shows guided form UI + preview container
 *
 * Production code should use:
 * - PixelCraft user-editor libs: `admin-cms/src/PixelCraft/user-editor/*`
 * - Save ONLY variableValues (not canvas JSON) to cart/order
 */
export function UserPersonalizationEditorShell({
  slug,
  productId,
}: {
  /** Product slug for URL (e.g. /product/my-slug, /personalize/my-slug). */
  slug?: string;
  /** @deprecated Use slug instead for storefront URLs. */
  productId?: string;
}) {
  const identifier = slug ?? productId ?? "";
  const [values, setValues] = useState<Record<string, string>>({
    customer_name: "",
  });

  const fields = useMemo(
    () => [
      { id: "customer_name", label: "Your name", type: "text" as const },
      { id: "photo_1", label: "Photo", type: "image" as const },
    ],
    []
  );

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-3">
        <div className="text-sm text-gray-500">Personalize product</div>
        <div className="text-xl font-semibold">{identifier}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded border bg-white p-4">
          <div className="font-medium">Personalize</div>
          <div className="mt-3 space-y-3">
            {fields.map((f) => (
              <div key={f.id}>
                <label className="text-sm font-medium">{f.label}</label>
                {f.type === "text" ? (
                  <input
                    className="mt-1 w-full rounded border px-3 py-2 text-sm"
                    value={values[f.id] ?? ""}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.id]: e.target.value }))
                    }
                    placeholder={`Enter ${f.label.toLowerCase()}`}
                  />
                ) : (
                  <input
                    className="mt-1 w-full text-sm"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const url = URL.createObjectURL(file);
                      setValues((v) => ({ ...v, [f.id]: url }));
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          <button className="mt-4 w-full rounded bg-black px-4 py-2 text-sm text-white">
            Add to cart
          </button>
        </div>

        <div className="rounded border bg-white p-4">
          <div className="font-medium">Preview</div>
          <div className="mt-3 h-[420px] rounded bg-gray-100 p-4 text-sm text-gray-600">
            Real-time preview goes here. Use:
            <ul className="mt-2 list-disc pl-5">
              <li>`PixelCraft/enhancements/realTimePreview.ts` for preview hook</li>
              <li>`PixelCraft/user-editor/lib/restrictedDeserialize.ts` to lock objects</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

