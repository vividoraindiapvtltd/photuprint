import React, { useState, useEffect } from "react";

const MediaUploaderWithThumbnails = ({ media, setMedia, maxAdditional = 9 }) => {
  const [mainImage, setMainImage] = useState(media[0] || null);
  const [additionalMedia, setAdditionalMedia] = useState(media.slice(1) || []);

  const handleMainImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Main image must be an image file");
      return;
    }
    setMainImage(file);
  };

  const handleAdditionalMediaChange = (index, e) => {
    const file = e.target.files[0];
    if (!file) return;
    const updated = [...additionalMedia];
    updated[index].file = file;
    setAdditionalMedia(updated);
  };

  const handleOptionNameChange = (index, value) => {
    const updated = [...additionalMedia];
    updated[index].name = value;
    setAdditionalMedia(updated);
  };

  const addMediaInput = () => {
    if (additionalMedia.length >= maxAdditional) {
      alert(`Maximum ${maxAdditional} additional media allowed`);
      return;
    }
    setAdditionalMedia([...additionalMedia, { file: null, name: `Option ${additionalMedia.length + 1}` }]);
  };

  const removeMediaInput = (index) => {
    const updated = [...additionalMedia];
    updated.splice(index, 1);
    // Re-label options
    const relabeled = updated.map((item, idx) => ({ ...item, name: `Option ${idx + 1}` }));
    setAdditionalMedia(relabeled);
  };

  // Update parent media array whenever main/additional changes
  useEffect(() => {
    const mediaArray = [];
    if (mainImage) mediaArray.push({ file: mainImage, main: true });
    additionalMedia.forEach((item) => {
      if (item.file) mediaArray.push({ file: item.file, main: false, name: item.name });
    });
    setMedia(mediaArray);
  }, [mainImage, additionalMedia, setMedia]);

  return (
    <div className="p-4 bg-white rounded-xl shadow mb-6">
      <label className="font-medium mb-2 block">Product Media</label>

      {/* Main Image */}
      <div className="mb-4">
        <label className="font-semibold">Main Image</label>
        <div className="flex items-center gap-2 mt-1">
          <input type="file" accept="image/*" onChange={handleMainImageChange} />
          {mainImage && (
            <div className="flex items-center gap-2">
              <img
                src={URL.createObjectURL(mainImage)}
                alt="Main"
                className="w-20 h-20 object-cover rounded border"
              />
              <span className="text-sm">{mainImage.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Additional Media */}
      <div className="mb-4">
        <label className="font-semibold">Additional Images/Videos</label>

        {additionalMedia.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2 mt-2">
            {/* File input */}
            <input
              type="file"
              accept="image/*,video/*"
              onChange={(e) => handleAdditionalMediaChange(idx, e)}
            />

            {/* Thumbnail / Video */}
            {item.file && (
              <>
                {item.file.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(item.file)}
                    alt={`Option ${idx + 1}`}
                    className="w-16 h-16 object-cover rounded border"
                  />
                ) : (
                  <video
                    src={URL.createObjectURL(item.file)}
                    className="w-20 h-20 object-cover rounded border"
                    controls
                  />
                )}
              </>
            )}

            {/* Option Name */}
            <input
              type="text"
              value={item.name}
              onChange={(e) => handleOptionNameChange(idx, e.target.value)}
              className="border px-2 py-1 rounded flex-1"
            />

            {/* Delete button */}
            <button
              type="button"
              onClick={() => removeMediaInput(idx)}
              className="text-red-600 hover:text-red-800"
              title="Remove"
            >
              ✕
            </button>
          </div>
        ))}

        {additionalMedia.length < maxAdditional && (
          <button
            type="button"
            onClick={addMediaInput}
            className="mt-2 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
          >
            + Add Media
          </button>
        )}
      </div>
    </div>
  );
};

export default MediaUploaderWithThumbnails;
