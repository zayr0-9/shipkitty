import { PointerEvent, useEffect, useRef, useState } from 'react';
import type { ImageCrop } from '../image';

type ImageCropEditorProps = {
  file: File;
  onCancel: () => void;
  onApply: (crop: ImageCrop) => void;
};

type DisplayRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type DragState =
  | {
      pointerId: number;
      mode: 'resize';
      handle: 'nw' | 'ne' | 'sw' | 'se';
    }
  | {
      pointerId: number;
      mode: 'pan';
      startX: number;
      startY: number;
      crop: ImageCrop;
    };

const MIN_CROP_SIZE = 128;
const buttonClass = 'inline-flex min-h-12 items-center justify-center rounded-full px-5 py-3 text-center font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60';

export function ImageCropEditor({ file, onCancel, onApply }: ImageCropEditorProps) {
  const imageRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [displayRect, setDisplayRect] = useState<DisplayRect>({ left: 0, top: 0, width: 0, height: 0 });
  const [crop, setCrop] = useState<ImageCrop>({ x: 0, y: 0, size: 0 });
  const [imageUrl, setImageUrl] = useState('');

  useEffect(() => {
    const nextImageUrl = URL.createObjectURL(file);
    setImageUrl(nextImageUrl);
    return () => URL.revokeObjectURL(nextImageUrl);
  }, [file]);

  function handleImageLoad() {
    const image = imageRef.current;
    if (!image || !image.naturalWidth || !image.naturalHeight) return;

    const size = Math.min(image.naturalWidth, image.naturalHeight);
    setImageSize({ width: image.naturalWidth, height: image.naturalHeight });
    setCrop({
      x: Math.round((image.naturalWidth - size) / 2),
      y: Math.round((image.naturalHeight - size) / 2),
      size,
    });
    updateDisplayRect();
  }

  function handleImageError() {
    setImageSize({ width: 0, height: 0 });
    setDisplayRect({ left: 0, top: 0, width: 0, height: 0 });
    setCrop({ x: 0, y: 0, size: 0 });
  }

  function updateDisplayRect() {
    const image = imageRef.current;
    if (!image) return;

    const rect = image.getBoundingClientRect();
    const parentRect = image.parentElement?.getBoundingClientRect();
    setDisplayRect({
      left: parentRect ? rect.left - parentRect.left : 0,
      top: parentRect ? rect.top - parentRect.top : 0,
      width: rect.width,
      height: rect.height,
    });
  }

  function startResize(event: PointerEvent<HTMLButtonElement>, handle: 'nw' | 'ne' | 'sw' | 'se') {
    if (!crop.size || !imageSize.width || !imageSize.height) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = { pointerId: event.pointerId, mode: 'resize', handle };
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!crop.size || !imageSize.width || !imageSize.height) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      mode: 'pan',
      startX: event.clientX,
      startY: event.clientY,
      crop,
    };
  }

  function handleCropPointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId || !displayRect.width || !displayRect.height) return;

    if (dragState.mode === 'pan') {
      const deltaX = ((event.clientX - dragState.startX) / displayRect.width) * imageSize.width;
      const deltaY = ((event.clientY - dragState.startY) / displayRect.height) * imageSize.height;
      setCrop(clampCrop({ ...dragState.crop, x: dragState.crop.x + deltaX, y: dragState.crop.y + deltaY }, imageSize));
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const imageX = ((event.clientX - rect.left - displayRect.left) / displayRect.width) * imageSize.width;
    const imageY = ((event.clientY - rect.top - displayRect.top) / displayRect.height) * imageSize.height;

    setCrop((current) => resizeCropFromCorner(current, imageSize, dragState.handle, imageX, imageY));
  }

  function stopCropPointer(event: PointerEvent<HTMLDivElement>) {
    if (dragStateRef.current?.pointerId === event.pointerId) {
      dragStateRef.current = null;
    }
  }

  const maxCropSize = Math.min(imageSize.width, imageSize.height) || MIN_CROP_SIZE;
  const cropBoxStyle = getCropBoxStyle(crop, imageSize, displayRect);
  const previewStyle = getPreviewStyle(crop, imageSize, imageUrl);

  return (
    <div className="grid gap-4 rounded-3xl border border-amber-200 bg-amber-50/70 p-4 dark:border-neutral-700 dark:bg-neutral-900/80">
      <div>
        <h3 className="text-lg font-black text-neutral-950 dark:text-neutral-50">Crop image</h3>
        <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300">Drag the square to pan it. Drag a corner to resize, then fine-tune size with the slider.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_8rem] sm:items-start">
        <div className="relative touch-none overflow-hidden rounded-2xl bg-white dark:bg-neutral-950" onPointerMove={handleCropPointerMove} onPointerUp={stopCropPointer} onPointerCancel={stopCropPointer}>
          {imageUrl ? (
            <img ref={imageRef} className="max-h-72 w-full object-contain select-none" src={imageUrl} alt="Selected crop source" draggable={false} onLoad={handleImageLoad} onError={handleImageError} />
          ) : (
            <div className="grid min-h-56 place-items-center p-4 text-center font-bold text-amber-800 dark:text-neutral-300">Loading image...</div>
          )}
          {!!crop.size && !!displayRect.width && (
            <div className="absolute cursor-move border-2 border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] ring-2 ring-amber-400" style={cropBoxStyle} onPointerDown={startPan}>
              {(['nw', 'ne', 'sw', 'se'] as const).map((handle) => (
                <button
                  key={handle}
                  className={`pointer-events-auto absolute h-6 w-6 rounded-full border-2 border-white bg-amber-500 shadow ${handle === 'nw' ? '-left-3 -top-3 cursor-nwse-resize' : ''}${handle === 'ne' ? '-right-3 -top-3 cursor-nesw-resize' : ''}${handle === 'sw' ? '-bottom-3 -left-3 cursor-nesw-resize' : ''}${handle === 'se' ? '-bottom-3 -right-3 cursor-nwse-resize' : ''}`}
                  type="button"
                  aria-label={`Resize crop from ${handle} corner`}
                  onPointerDown={(event) => startResize(event, handle)}
                />
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="mb-2 text-sm font-extrabold text-neutral-700 dark:text-neutral-100">Square crop</p>
          <div className="aspect-square w-full rounded-2xl border border-amber-200 bg-white bg-no-repeat shadow-inner dark:border-neutral-700 dark:bg-neutral-950" style={previewStyle} />
        </div>
      </div>

      <label className="grid gap-2 text-sm font-extrabold text-neutral-700 dark:text-neutral-100">
        Crop size
        <input type="range" min={Math.min(MIN_CROP_SIZE, maxCropSize)} max={maxCropSize} value={crop.size || MIN_CROP_SIZE} disabled={!crop.size} onChange={(event) => setCrop((current) => resizeCropFromCenter(current, imageSize, Number(event.target.value)))} />
      </label>

      <div className="grid gap-3 sm:flex sm:justify-end">
        <button className={`${buttonClass} bg-white text-amber-950 hover:bg-amber-100 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-1 dark:ring-neutral-700 dark:hover:bg-neutral-700`} type="button" onClick={onCancel}>Cancel</button>
        <button className={`${buttonClass} bg-neutral-950 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-950 dark:hover:bg-neutral-200`} type="button" onClick={() => onApply(crop)} disabled={!crop.size}>Use this crop</button>
      </div>
    </div>
  );
}

function resizeCropFromCorner(crop: ImageCrop, imageSize: { width: number; height: number }, handle: 'nw' | 'ne' | 'sw' | 'se', pointerX: number, pointerY: number) {
  const oppositeX = handle.includes('w') ? crop.x + crop.size : crop.x;
  const oppositeY = handle.includes('n') ? crop.y + crop.size : crop.y;
  const rawSize = Math.max(Math.abs(pointerX - oppositeX), Math.abs(pointerY - oppositeY));
  const maxSize = Math.min(imageSize.width, imageSize.height);
  const size = Math.max(1, Math.min(rawSize, maxSize));
  const x = handle.includes('w') ? oppositeX - size : oppositeX;
  const y = handle.includes('n') ? oppositeY - size : oppositeY;
  return clampCrop({ x, y, size }, imageSize);
}

function resizeCropFromCenter(crop: ImageCrop, imageSize: { width: number; height: number }, size: number) {
  const nextSize = Math.min(size, imageSize.width, imageSize.height);
  const centerX = crop.x + crop.size / 2;
  const centerY = crop.y + crop.size / 2;
  return clampCrop({ x: centerX - nextSize / 2, y: centerY - nextSize / 2, size: nextSize }, imageSize);
}

function clampCrop(crop: ImageCrop, imageSize: { width: number; height: number }) {
  const size = Math.min(Math.max(1, crop.size), imageSize.width, imageSize.height);
  return {
    size: Math.round(size),
    x: Math.round(Math.min(Math.max(0, crop.x), Math.max(0, imageSize.width - size))),
    y: Math.round(Math.min(Math.max(0, crop.y), Math.max(0, imageSize.height - size))),
  };
}

function getCropBoxStyle(crop: ImageCrop, imageSize: { width: number; height: number }, displayRect: DisplayRect) {
  if (!crop.size || !imageSize.width || !imageSize.height || !displayRect.width || !displayRect.height) return undefined;

  return {
    left: displayRect.left + (crop.x / imageSize.width) * displayRect.width,
    top: displayRect.top + (crop.y / imageSize.height) * displayRect.height,
    width: (crop.size / imageSize.width) * displayRect.width,
    height: (crop.size / imageSize.height) * displayRect.height,
  };
}

function getPreviewStyle(crop: ImageCrop, imageSize: { width: number; height: number }, imageUrl: string) {
  if (!crop.size || !imageSize.width || !imageSize.height) return { backgroundImage: `url(${imageUrl})` };

  const scale = 100 / crop.size;
  return {
    backgroundImage: `url(${imageUrl})`,
    backgroundSize: `${imageSize.width * scale}% ${imageSize.height * scale}%`,
    backgroundPosition: `${crop.x ? (crop.x / Math.max(1, imageSize.width - crop.size)) * 100 : 0}% ${crop.y ? (crop.y / Math.max(1, imageSize.height - crop.size)) * 100 : 0}%`,
  };
}
