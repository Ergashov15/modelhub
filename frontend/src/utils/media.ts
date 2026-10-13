import type { VideoFrame } from '../types';

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Resizes and compresses an image file to prevent massive payload sizes,
 * ensuring high fidelity for vision models while keeping transfer instant.
 */
export async function compressAndResizeImage(
  file: File | Blob,
  maxWidth = 1600,
  maxHeight = 1600,
  quality = 0.85
): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      if (!rawDataUrl) {
        resolve('');
        return;
      }

      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // If image is already smaller than limits and file is small, keep raw data
        if (width <= maxWidth && height <= maxHeight && file.size < 400 * 1024) {
          resolve(rawDataUrl);
          return;
        }

        // Calculate proportional scale
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        // Check if PNG with alpha or JPEG
        const isPng = file.type === 'image/png';
        if (!isPng) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Convert to lightweight JPEG (or PNG if transparent)
        try {
          const mime = isPng ? 'image/png' : 'image/jpeg';
          const compressed = canvas.toDataURL(mime, quality);
          resolve(compressed);
        } catch {
          resolve(rawDataUrl);
        }
      };

      img.onerror = () => {
        resolve(rawDataUrl);
      };

      img.src = rawDataUrl;
    };

    reader.onerror = () => {
      resolve('');
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Extracts sequential representative frames from a video for multimodal analysis.
 */
export async function extractVideoFrames(
  file: File,
  maxFrames = 8
): Promise<{
  previewUrl: string;
  thumbnailUrl: string;
  duration: number;
  frames: VideoFrame[];
}> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let isCleanedUp = false;
    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      video.pause();
      video.removeAttribute('src');
      video.load();
    };

    // Overall timeout safety (15 seconds)
    const timeoutTimer = setTimeout(() => {
      cleanup();
      reject(new Error('Video tahlil qilish vaqti tugadi (Timeout)'));
    }, 15000);

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      if (!duration || isNaN(duration) || duration <= 0) {
        clearTimeout(timeoutTimer);
        cleanup();
        reject(new Error('Video davomiyligini aniqlab bo‘lmadi'));
        return;
      }

      // Calculate frame count based on duration (4 to maxFrames)
      const count = Math.min(Math.max(4, Math.ceil(duration / 3)), maxFrames);
      const timestamps: number[] = [];
      for (let i = 0; i < count; i++) {
        // Evenly distributed across video duration
        const t = (duration * (i + 0.5)) / count;
        timestamps.push(Math.min(t, Math.max(0, duration - 0.1)));
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        clearTimeout(timeoutTimer);
        cleanup();
        reject(new Error('Canvas context xatoligi'));
        return;
      }

      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 360;
      const targetWidth = Math.min(720, vw);
      const targetHeight = Math.round(targetWidth * (vh / vw)) || 400;
      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const frames: VideoFrame[] = [];

      try {
        for (const time of timestamps) {
          await new Promise<void>((resSeek) => {
            let done = false;
            const onSeeked = () => {
              if (done) return;
              done = true;
              video.removeEventListener('seeked', onSeeked);
              resSeek();
            };
            video.addEventListener('seeked', onSeeked);
            video.currentTime = time;
            // Seek timeout per frame
            setTimeout(onSeeked, 1500);
          });

          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const frameData = canvas.toDataURL('image/jpeg', 0.8);
          frames.push({
            time: formatDuration(time),
            timestamp: time,
            dataUrl: frameData,
          });
        }

        clearTimeout(timeoutTimer);
        const thumbnailUrl = frames[0]?.dataUrl || '';

        resolve({
          previewUrl: objectUrl,
          thumbnailUrl,
          duration,
          frames,
        });
      } catch (err) {
        clearTimeout(timeoutTimer);
        cleanup();
        reject(err);
      }
    };

    video.onerror = () => {
      clearTimeout(timeoutTimer);
      cleanup();
      reject(new Error('Video faylni o‘qib bo‘lmadi yoki format qo‘llab-quvvatlanmaydi'));
    };
  });
}
