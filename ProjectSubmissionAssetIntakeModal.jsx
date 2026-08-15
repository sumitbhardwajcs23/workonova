import { useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  Image as ImageIcon,
  Link2,
  Trash2,
  UploadCloud,
} from "lucide-react";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = ["png", "jpg", "jpeg", "svg", "webp", "pdf", "docx", "doc", "txt"];
const EXECUTABLE_EXTENSIONS = [
  "exe", "bat", "cmd", "com", "msi", "sh", "bash", "zsh", "ps1", "app", "jar", "bin", "dll", "apk", "dmg", "iso", "deb", "rpm",
];

const extensionOf = (fileName) => fileName.split(".").pop()?.toLowerCase() ?? "";
const isCloudFolderUrl = (value) => {
  try {
    const { hostname } = new URL(value);
    return /(^|\.)drive\.google\.com$/i.test(hostname) || /(^|\.)dropbox\.com$/i.test(hostname);
  } catch {
    return false;
  }
};
const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

function AssetIcon({ extension }) {
  if (["png", "jpg", "jpeg", "svg", "webp"].includes(extension)) {
    return <ImageIcon className="h-5 w-5 text-violet-300" aria-hidden="true" />;
  }
  return <FileText className="h-5 w-5 text-sky-300" aria-hidden="true" />;
}

/**
 * Drop this component into a React + Tailwind project. Pass onClose to dismiss it
 * and onSubmit to send the validated data to the application's API.
 */
export default function ProjectSubmissionAssetIntakeModal({ onClose, onSubmit }) {
  const inputRef = useRef(null);
  const [cloudUrl, setCloudUrl] = useState("");
  const [files, setFiles] = useState([]);
  const [aspectRatio, setAspectRatio] = useState("");
  const [brief, setBrief] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState("");

  const hasUrlValue = cloudUrl.trim().length > 0;
  const validUrl = isCloudFolderUrl(cloudUrl.trim());
  const canSubmit = validUrl && Boolean(aspectRatio);

  const addFiles = (incomingFiles) => {
    const accepted = [];
    let error = "";

    Array.from(incomingFiles).forEach((file) => {
      const extension = extensionOf(file.name);
      if (EXECUTABLE_EXTENSIONS.includes(extension)) {
        error = "⛔ Executable (.exe) files are not allowed for security reasons.";
        return;
      }
      if (!ACCEPTED_EXTENSIONS.includes(extension)) {
        error ||= "⚠️ Only images and document files are allowed.";
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        error ||= `⚠️ ${file.name} is larger than the 25 MB per-file limit.`;
        return;
      }
      accepted.push(file);
    });

    setFileError(error);
    setFiles((currentFiles) => {
      const known = new Set(currentFiles.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
      return [...currentFiles, ...accepted.filter((file) => !known.has(`${file.name}-${file.size}-${file.lastModified}`))];
    });
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit?.({ cloudUrl: cloudUrl.trim(), files, aspectRatio, brief: brief.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section
        aria-labelledby="asset-intake-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-900 text-neutral-100 shadow-2xl"
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start justify-between gap-6 border-b border-neutral-800 px-6 py-5">
          <div>
            <h2 id="asset-intake-title" className="text-xl font-semibold tracking-tight text-white">Submit Project Assets &amp; Brief</h2>
            <p className="mt-1 text-sm text-neutral-400">Provide footage links and upload supporting documents.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white" aria-label="Close modal">✕</button>
        </header>

        <form onSubmit={handleSubmit} className="space-y-7 px-6 py-6">
          <section>
            <label htmlFor="footage-link" className="mb-2 block text-sm font-medium text-neutral-200">Raw Video Footage Link (Google Drive or Dropbox)<span className="text-violet-400">*</span></label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
              <input id="footage-link" value={cloudUrl} onChange={(event) => setCloudUrl(event.target.value)} type="url" placeholder="https://drive.google.com/..." className="w-full rounded-xl border border-neutral-700 bg-neutral-950 py-3 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" required />
            </div>
            {hasUrlValue && (validUrl ? <p className="mt-2 flex items-center gap-1.5 text-sm text-emerald-400"><CheckCircle className="h-4 w-4" />✓ Valid cloud folder link</p> : <p className="mt-2 flex items-center gap-1.5 text-sm text-amber-400"><AlertTriangle className="h-4 w-4" />⚠️ Please provide a valid Google Drive or Dropbox URL.</p>)}
            <p className="mt-3 rounded-lg border border-sky-900/70 bg-sky-950/40 px-3 py-2 text-xs leading-5 text-sky-200">🔒 Make sure your folder sharing permission is set to “Anyone with the link can view”.</p>
          </section>

          <section>
            <label className="mb-2 block text-sm font-medium text-neutral-200">Brand Assets &amp; Documents <span className="font-normal text-neutral-500">(Direct Upload)</span></label>
            <div onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }} onDragLeave={() => setIsDragging(false)} onDrop={handleDrop} className={`rounded-xl border border-dashed p-7 text-center transition ${isDragging ? "border-violet-400 bg-violet-500/10" : "border-neutral-700 bg-neutral-950/50 hover:border-neutral-500"}`}>
              <UploadCloud className="mx-auto h-8 w-8 text-violet-300" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-neutral-200">Drop files here, or <button type="button" onClick={() => inputRef.current?.click()} className="text-violet-300 underline underline-offset-2 hover:text-violet-200">browse your device</button></p>
              <p className="mt-1 text-xs text-neutral-500">PNG, JPG, JPEG, SVG, WEBP, PDF, DOCX, DOC, TXT · Up to 25 MB each</p>
              <input ref={inputRef} type="file" multiple className="sr-only" accept=".png,.jpg,.jpeg,.svg,.webp,.pdf,.docx,.doc,.txt" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
            </div>
            {fileError && <div role="alert" className="mt-3 flex gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-3 text-sm font-medium text-red-200"><AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />{fileError}</div>}
            {files.length > 0 && <ul className="mt-3 space-y-2" aria-label="Selected files">{files.map((file) => { const extension = extensionOf(file.name); const id = `${file.name}-${file.size}-${file.lastModified}`; return <li key={id} className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5"><AssetIcon extension={extension} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-neutral-200">{file.name}</p><p className="text-xs text-neutral-500">{extension.toUpperCase()} · {formatSize(file.size)}</p></div><button type="button" onClick={() => setFiles((currentFiles) => currentFiles.filter((item) => item !== file))} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-neutral-400 transition hover:bg-red-500/10 hover:text-red-300"><Trash2 className="h-3.5 w-3.5" />Remove</button></li>; })}</ul>}
          </section>

          <section>
            <fieldset><legend className="mb-3 text-sm font-medium text-neutral-200">Aspect Ratio<span className="text-violet-400">*</span></legend><div className="grid gap-3 sm:grid-cols-3">{[["9:16", "Reels / TikTok"], ["16:9", "YouTube / Landscape"], ["1:1", "Square / Feed"]].map(([ratio, label]) => <label key={ratio} className={`cursor-pointer rounded-xl border p-3 text-center transition ${aspectRatio === ratio ? "border-violet-400 bg-violet-500/15 ring-1 ring-violet-400" : "border-neutral-700 bg-neutral-950 hover:border-neutral-500"}`}><input type="radio" className="sr-only" name="aspect-ratio" value={ratio} checked={aspectRatio === ratio} onChange={(event) => setAspectRatio(event.target.value)} /><span className="block text-base font-semibold text-white">{ratio}</span><span className="mt-1 block text-xs text-neutral-400">{label}</span></label>)}</div></fieldset>
            <label htmlFor="project-brief" className="mb-2 mt-6 block text-sm font-medium text-neutral-200">Project Brief / Special Instructions</label>
            <textarea id="project-brief" value={brief} onChange={(event) => setBrief(event.target.value)} rows={4} placeholder="Mention pacing, music preferences, subtitles style, or specific timestamps..." className="w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20" />
          </section>

          <footer className="flex flex-col-reverse gap-3 border-t border-neutral-800 pt-5 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl border border-neutral-700 px-4 py-2.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white">Cancel</button><button type="submit" disabled={!canSubmit} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-500">Submit Assets &amp; Start Project 🚀</button></footer>
        </form>
      </section>
    </div>
  );
}
