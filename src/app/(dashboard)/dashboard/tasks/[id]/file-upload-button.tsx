"use client";

import { useRef, useState } from "react";

interface FileUploadButtonProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

const ACCEPT =
  "image/*,.pdf,.doc,.docx,.txt,.md,.csv,.json,.zip,.tar.gz,.py,.js,.ts,.tsx";
const MAX_SIZE_MB = 10;

export function FileUploadButton({
  onFileSelected,
  disabled = false,
}: FileUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large (max ${MAX_SIZE_MB}MB)`);
      return;
    }

    setError(null);
    onFileSelected(file);

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-200 bg-stone-50 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:opacity-50"
        title="Attach file"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
        </svg>
      </button>
      {error && (
        <p className="absolute left-0 top-full mt-1 whitespace-nowrap text-[10px] text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
