import { useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type LiveCameraCaptureDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with JPEG data URL after capture */
  onCaptured: (dataUrl: string) => void;
  /** Selfie vs document / rear camera */
  facingMode: "user" | "environment";
  title: string;
  description?: string;
};

async function getVideoStream(facingMode: "user" | "environment"): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facingMode } },
      audio: false,
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  }
}

export function LiveCameraCaptureDialog({
  open,
  onOpenChange,
  onCaptured,
  facingMode,
  title,
  description = "Allow camera access when prompted. Images are captured live — not chosen from your gallery.",
}: LiveCameraCaptureDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  useEffect(() => {
    if (!open) {
      stopStream();
      setCameraError(null);
      setStarting(false);
      setVideoReady(false);
      return;
    }

    let cancelled = false;
    setStarting(true);
    setCameraError(null);
    setVideoReady(false);

    (async () => {
      try {
        const stream = await getVideoStream(facingMode);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
      } catch {
        if (!cancelled) {
          setCameraError("Could not access the camera. Check permissions and try again.");
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open, facingMode]);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    stopStream();
    onCaptured(dataUrl);
    onOpenChange(false);
  };

  const handleClose = (next: boolean) => {
    if (!next) stopStream();
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="z-[100] max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg gap-0 overflow-hidden border-slate-200 bg-white p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-slate-100 px-4 py-3 text-left sm:px-6">
          <DialogTitle className="font-sans text-lg text-slate-900">{title}</DialogTitle>
          <DialogDescription className="text-left text-slate-600">{description}</DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[4/3] w-full bg-slate-900">
          {starting && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80">
              <Loader2 className="h-10 w-10 animate-spin text-white" />
            </div>
          )}
          {cameraError && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900 p-4 text-center text-sm text-white">
              {cameraError}
            </div>
          )}
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            onLoadedMetadata={() => {
              const v = videoRef.current;
              setVideoReady(!!v?.videoWidth && !!v?.videoHeight);
            }}
            className="h-full w-full object-cover"
          />
        </div>

        <DialogFooter className="flex-row flex-wrap gap-2 border-t border-slate-100 px-4 py-4 sm:px-6">
          <Button type="button" variant="outline" onClick={() => handleClose(false)} className="touch-manipulation">
            Cancel
          </Button>
          <Button
            type="button"
            className="touch-manipulation gap-2 bg-cyan-600 text-white hover:bg-cyan-700"
            disabled={!!cameraError || starting || !videoReady}
            onClick={handleCapture}
          >
            <Camera className="h-4 w-4" />
            Capture photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
