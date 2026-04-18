'use client';

import { useRef, useState, useImperativeHandle, forwardRef } from 'react';

export interface CameraCaptureRef {
  openCamera: () => void;
  openFilePicker: () => void;
}

interface CameraCaptureProps {
  onCapture: (image: string) => void;
}

const CameraCapture = forwardRef<CameraCaptureRef, CameraCaptureProps>(
  function CameraCapture({ onCapture }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [streaming, setStreaming] = useState(false);

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreaming(true);
        }
      } catch (error) {
        console.error('Unable to access camera:', error);
      }
    };

    const stopCamera = () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        setStreaming(false);
      }
    };

    const capturePhoto = () => {
      if (canvasRef.current && videoRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0);
          const imageData = canvasRef.current.toDataURL('image/jpeg');
          onCapture(imageData);
          stopCamera();
        }
      }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target?.result as string;
          onCapture(imageData);
        };
        reader.readAsDataURL(file);
      }
    };

    useImperativeHandle(ref, () => ({
      openCamera: startCamera,
      openFilePicker: () => fileInputRef.current?.click(),
    }));

    return (
      <>
        {/* Camera overlay */}
        {streaming && (
          <div className="camera-overlay">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="max-w-full max-h-[70vh] rounded-2xl"
            />
            <div className="flex gap-4 mt-6">
              <button
                onClick={capturePhoto}
                className="btn-primary px-8 py-3 text-base"
              >
                Capture
              </button>
              <button
                onClick={stopCamera}
                className="px-8 py-3 rounded-2xl text-base font-semibold bg-white/20 text-white backdrop-blur"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
      </>
    );
  }
);

export default CameraCapture;
